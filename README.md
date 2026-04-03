# Frontend – Online Auction Platform

## Giới thiệu
Đây là phần frontend của dự án **Web Nền Tảng Đấu Giá Trực Tuyến (Online Auction Platform)**.  
Frontend chịu trách nhiệm xây dựng giao diện người dùng và xử lý trải nghiệm realtime cho hệ thống đấu giá, bảo đảm người dùng có thể theo dõi giá, lịch sử bid, countdown và trạng thái đấu giá một cách mượt mà, trực quan và đồng bộ theo thời gian thực.

Phạm vi triển khai tập trung vào:
- Trang chủ hiển thị danh sách phiên đấu giá
- Trang chi tiết phiên đấu giá
- Dashboard cho Seller/Admin
- Tích hợp Socket.io Client để cập nhật dữ liệu realtime
- Giao diện hỗ trợ Smart Proxy Bidding
- Thông báo khi người dùng bị outbid

---
## Cấu trúc thư mục

frontend/
├── assets/
│   ├── images/             
│   │   ├── logo.png 
|   |   └── mockdata
|   |       ├──1.png
|   |       ├──2.png
|   |       ├──3.png
|   |       ├──4.png
|   |       ├──5.png
|   |       ├──6.png
|   |       └──7.png
│   └── icons/              
│       ├── logo.png 
|       ├── cart.png
|       └── bidding.png
├── css/
│   ├── main.css            
│   ├── components.css     
│   ├── auction-detail.css  
│   └── dashboard.css       
├── js/
│   ├── core/
│   │   ├── socket-client.js 
│   │   └── api-client.js   
│   ├── modules/
│   │   ├── auction-list.js 
│   │   ├── bid-logic.js     
│   │   ├── countdown.js     
│   │   └── notifications.js  
│   └── main.js               
├── pages/                   
│   ├── product-detail.html   
│   └── dashboard.html       
└── index.html               