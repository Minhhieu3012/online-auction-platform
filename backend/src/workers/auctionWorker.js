const logger = require("../utils/logger");
const redisKeys = require("../utils/redis-keys");
const { Worker, Queue } = require("bullmq");
const { connection } = require("../config/queue");
const redisClient = require("../config/redis");
const pool = require("../config/db");
const { producer } = require("../config/kafka");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const auctionQueue = new Queue("auction-lifecycle", { connection });
const LOCK_TTL = 30000;

async function acquireLock(redis, lockKey) {
  return await redis.set(lockKey, "1", {
    NX: true,
    PX: LOCK_TTL,
  });
}

async function safeSetClosing(redis, auctionKey) {
  const lua = `
    local status = redis.call("HGET", KEYS[1], "status")
    if status == "Active" then
      redis.call("HSET", KEYS[1], "status", "Closing")
      return 1
    end
    if status == "Closing" then
      return 1
    end
    return 0
  `;

  try {
    return await redis.eval(lua, { keys: [auctionKey] });
  } catch (error) {
    logger.warn(`[Worker] Không thể set Closing trên Redis: ${error.message}`);
    return 0;
  }
}

function parseFlexibleTime(value) {
  if (!value) return 0;

  if (value instanceof Date) return value.getTime();

  const text = String(value).trim();

  if (/^\d+$/.test(text)) {
    const number = Number(text);
    return number > 0 ? number : 0;
  }

  if (text.includes("GMT") || text.endsWith("Z")) {
    const parsed = new Date(text).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  const parsed = new Date(text.replace(" ", "T") + "Z").getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

async function rescheduleCloseJob(auctionId, delay) {
  await auctionQueue.add(
    "close-auction",
    { auctionId },
    {
      delay: Math.max(0, delay),
      jobId: `close-auction-${auctionId}`,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: true,
      removeOnFail: true,
    },
  );
}

async function publishAuctionFinalized(payload) {
  try {
    await producer.send({
      topic: "winner-notifications",
      messages: [
        {
          key: String(payload.auctionId),
          value: JSON.stringify(payload),
        },
      ],
    });
  } catch (error) {
    logger.error(`[Worker] Không thể gửi winner-notifications: ${error.message}`);
  }
}

async function refundLoserDeposits(deposits, winnerId) {
  for (const deposit of deposits) {
    if (Number(deposit.user_id) === Number(winnerId)) continue;

    try {
      if (deposit.provider_payment_id) {
        await stripe.refunds.create({ payment_intent: deposit.provider_payment_id });
      }

      await pool.execute(
        `
          UPDATE auction_deposits
          SET status = 'REFUNDED', refunded_at = NOW(), updated_at = NOW()
          WHERE id = ? AND status = 'SUCCEEDED'
        `,
        [deposit.id],
      );

      logger.info(`[Worker] Đã hoàn cọc $${deposit.amount} cho user ${deposit.user_id}`);
    } catch (refundErr) {
      logger.error(`[Worker] Lỗi hoàn tiền user ${deposit.user_id}: ${refundErr.message}`);
    }
  }
}

const auctionWorker = new Worker(
  "auction-lifecycle",
  async (job) => {
    const auctionId = Number(job.data.auctionId);
    const auctionKey = redisKeys.auctionInfo(auctionId);
    const lockKey = redisKeys.auctionLock(auctionId);

    if (!auctionId) {
      logger.warn("[Worker] Job đóng phiên thiếu auctionId. Bỏ qua.");
      return;
    }

    logger.info(`\n[Worker] Bắt đầu tiến trình đóng phiên ${auctionId} và xác định người thắng...`);

    const lock = await acquireLock(redisClient, lockKey);
    if (!lock) {
      logger.info(`[Worker] Bỏ qua: Phiên ${auctionId} đang được xử lý bởi tiến trình khác.`);
      return;
    }

    const dbConnection = await pool.getConnection();

    try {
      const auctionData = await redisClient.hGetAll(auctionKey);

      const [timeRows] = await pool.execute(
        `
          SELECT id, status, end_time
          FROM Auctions
          WHERE id = ?
          LIMIT 1
        `,
        [auctionId],
      );

      if (timeRows.length === 0) {
        logger.warn(`[Worker] Không tìm thấy phiên ${auctionId}.`);
        return;
      }

      const dbEndTimeMs = parseFlexibleTime(timeRows[0].end_time);
      const redisEndTimeMs = parseFlexibleTime(auctionData?.end_time);
      const latestEndTimeMs = Math.max(dbEndTimeMs, redisEndTimeMs);

      if (latestEndTimeMs > Date.now()) {
        const delay = latestEndTimeMs - Date.now();
        logger.info(`[Worker] Phiên ${auctionId} chưa tới hạn đóng hoặc đã được gia hạn. Hẹn lại sau ${delay}ms.`);
        await rescheduleCloseJob(auctionId, delay);
        return;
      }

      await safeSetClosing(redisClient, auctionKey);

      await dbConnection.beginTransaction();

      const [auctionRows] = await dbConnection.execute(
        `
          SELECT id, status, current_price, deposit_amount, winner_id, final_price, version
          FROM Auctions
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [auctionId],
      );

      if (auctionRows.length === 0) {
        await dbConnection.rollback();
        logger.warn(`[Worker] Không tìm thấy phiên ${auctionId} khi lock DB.`);
        return;
      }

      const auction = auctionRows[0];

      if (["Payment Pending", "Completed"].includes(auction.status) && auction.winner_id) {
        await dbConnection.rollback();
        logger.info(`[Worker] Phiên ${auctionId} đã được finalize trước đó. Bỏ qua.`);
        return;
      }

      const [bidRows] = await dbConnection.execute(
        `
          SELECT id, user_id, bid_amount, created_at
          FROM Bids
          WHERE auction_id = ?
          ORDER BY bid_amount DESC, created_at ASC, id ASC
          LIMIT 1
        `,
        [auctionId],
      );

      const [deposits] = await dbConnection.execute(
        `
          SELECT id, user_id, amount, provider_payment_id, status
          FROM auction_deposits
          WHERE auction_id = ? AND status = 'SUCCEEDED'
        `,
        [auctionId],
      );

      const hasWinner = bidRows.length > 0;
      const highestBid = hasWinner ? bidRows[0] : null;
      const winnerId = hasWinner ? Number(highestBid.user_id) : null;
      const winningBidId = hasWinner ? Number(highestBid.id) : null;
      const finalPrice = hasWinner ? Number(highestBid.bid_amount) : null;
      let finalStatus = hasWinner ? "Payment Pending" : "Ended";
      let depositApplied = 0;
      let depositId = null;
      let remainingAmount = 0;
      let settlementId = null;

      if (hasWinner) {
        const winnerDeposit = deposits.find((deposit) => Number(deposit.user_id) === winnerId);

        if (winnerDeposit) {
          depositApplied = Number(winnerDeposit.amount || 0);
          depositId = Number(winnerDeposit.id);

          await dbConnection.execute(
            `
              UPDATE auction_deposits
              SET status = 'APPLIED_TO_WIN_PAYMENT', applied_at = NOW(), updated_at = NOW()
              WHERE id = ? AND status = 'SUCCEEDED'
            `,
            [depositId],
          );
        }

        remainingAmount = Math.max(0, finalPrice - depositApplied);
        finalStatus = remainingAmount === 0 ? "Completed" : "Payment Pending";

        await dbConnection.execute(
          `
            INSERT INTO auction_settlements (
              auction_id,
              winner_id,
              winning_bid_id,
              deposit_id,
              final_price,
              deposit_applied_amount,
              remaining_amount,
              status,
              due_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 3 DAY))
            ON DUPLICATE KEY UPDATE
              winner_id = VALUES(winner_id),
              winning_bid_id = VALUES(winning_bid_id),
              deposit_id = VALUES(deposit_id),
              final_price = VALUES(final_price),
              deposit_applied_amount = VALUES(deposit_applied_amount),
              remaining_amount = VALUES(remaining_amount),
              status = VALUES(status),
              due_at = VALUES(due_at),
              updated_at = NOW()
          `,
          [
            auctionId,
            winnerId,
            winningBidId,
            depositId,
            finalPrice,
            depositApplied,
            remainingAmount,
            remainingAmount === 0 ? "PAID" : "PENDING",
          ],
        );

        const [settlementRows] = await dbConnection.execute(
          `SELECT id FROM auction_settlements WHERE auction_id = ? LIMIT 1`,
          [auctionId],
        );
        settlementId = settlementRows[0]?.id || null;
      }

      await dbConnection.execute(
        `
          UPDATE Auctions
          SET
            status = ?,
            winner_id = ?,
            final_price = ?,
            payment_due_at = CASE WHEN ? = 'Payment Pending' THEN DATE_ADD(NOW(), INTERVAL 3 DAY) ELSE payment_due_at END,
            version = version + 1,
            updated_at = NOW()
          WHERE id = ?
        `,
        [finalStatus, winnerId, finalPrice, finalStatus, auctionId],
      );

      await dbConnection.commit();

      if (hasWinner) {
        await refundLoserDeposits(deposits, winnerId);
      }

      const nextVersion = Number(auction.version || 0) + 1;

      await redisClient.hSet(auctionKey, {
        status: finalStatus,
        highest_bidder: winnerId ? String(winnerId) : "",
        current_price: finalPrice !== null ? String(finalPrice) : String(auction.current_price || 0),
        final_price: finalPrice !== null ? String(finalPrice) : "",
        winner_id: winnerId ? String(winnerId) : "",
        version: String(nextVersion),
      });

      await publishAuctionFinalized({
        auctionId,
        auction_id: auctionId,
        hasWinner,
        winnerId,
        winner_id: winnerId,
        userId: winnerId,
        user_id: winnerId,
        winningBidId,
        winning_bid_id: winningBidId,
        settlementId,
        settlement_id: settlementId,
        finalPrice,
        final_price: finalPrice,
        currentPrice: finalPrice !== null ? finalPrice : Number(auction.current_price || 0),
        current_price: finalPrice !== null ? finalPrice : Number(auction.current_price || 0),
        depositApplied,
        deposit_applied_amount: depositApplied,
        remainingAmount,
        remaining_amount: remainingAmount,
        status: finalStatus,
        version: nextVersion,
        finalizedAt: new Date().toISOString(),
      });

      logger.success(`[Worker] Chốt phiên ${auctionId} hoàn tất. Winner: ${winnerId || "NONE"}`);
    } catch (err) {
      await dbConnection.rollback();
      logger.error(`[Worker Error] Lỗi xử lý phiên ${auctionId}:`, err);
      throw err;
    } finally {
      dbConnection.release();
      await redisClient.del(lockKey);
    }
  },
  { connection },
);

module.exports = auctionWorker;