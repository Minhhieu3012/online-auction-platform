require("dotenv").config();

const bcrypt = require("bcryptjs");
const pool = require("../src/config/db");

const BCRYPT_SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

function getAdminConfig() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const email = process.env.ADMIN_EMAIL || "admin@brosgem.com";
  const password = process.env.ADMIN_PASSWORD || "Admin@123456";

  return {
    username,
    email: String(email).trim().toLowerCase(),
    password,
  };
}

async function seedAdmin() {
  const admin = getAdminConfig();

  if (!admin.username || !admin.email || !admin.password) {
    throw new Error("Missing ADMIN_USERNAME, ADMIN_EMAIL or ADMIN_PASSWORD.");
  }

  if (admin.password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters.");
  }

  const passwordHash = await bcrypt.hash(admin.password, BCRYPT_SALT_ROUNDS);

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.execute(
      `
        SELECT id, username, email, role
        FROM Users
        WHERE email = ? OR username = ?
        LIMIT 1
      `,
      [admin.email, admin.username],
    );

    if (existingRows.length > 0) {
      const existing = existingRows[0];

      await connection.execute(
        `
          UPDATE Users
          SET username = ?, email = ?, password = ?, role = 'admin'
          WHERE id = ?
        `,
        [admin.username, admin.email, passwordHash, existing.id],
      );

      await connection.commit();

      console.log(`[seed-admin] Updated existing user #${existing.id} to admin.`);
      return;
    }

    const [result] = await connection.execute(
      `
        INSERT INTO Users (username, email, password, role, balance)
        VALUES (?, ?, ?, 'admin', 0.00)
      `,
      [admin.username, admin.email, passwordHash],
    );

    await connection.commit();

    console.log(`[seed-admin] Created admin user #${result.insertId}.`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

seedAdmin()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("[seed-admin] Failed:", error);
    await pool.end();
    process.exit(1);
  });