const redisKeys = {
  // Key lưu thông tin và trạng thái của phiên đấu giá (Hash)
  auctionInfo: (auctionId) => `auction:${auctionId}:info`,

  // Key dùng để Khóa phân tán (Distributed Lock) cho Worker
  auctionLock: (auctionId) => `auction:${auctionId}:lock`,

  // Key lưu danh sách giá Auto-bid (Proxy Bidding) của các User trong 1 phiên
  auctionProxy: (auctionId) => `auction:${auctionId}:proxy`,
};

module.exports = redisKeys;
