# 🚀 Mini CRM Project

A simple full-stack CRM (Customer Relationship Management) web application built using **Node.js, Express, MongoDB, HTML, CSS, and JavaScript**.

---

## 📌 Features

- User login system
- Admin authentication
- Dashboard UI
- MongoDB database integration
- REST API backend
- Static frontend using HTML/CSS/JS
- Environment-based configuration using `.env`

---

## 🛠️ Tech Stack

- Node.js
- Express.js
- MongoDB Atlas
- HTML5
- CSS3
- JavaScript (Vanilla JS)
- dotenv

---

## 📁 Project Structure
crm/
│
├── server.js
├── package.json
├── .gitignore
├── .env.example
├── README.md
│
├── public/
│ ├── index.html
│ ├── login.html
│ ├── dashboard.html
│ ├── style.css
│
└── node_modules/ 

---

## ⚙️ Setup Instructions

### 1. Clone the repository
```bash
git clone https://github.com/your-username/crm-project.git
cd crm-project
2. Install dependencies
npm install
3. Create .env file
MONGO_URI=your_mongodb_connection_string
PORT=5001
JWT_SECRET=your_secret_key
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_admin_password
4. Run the server
node server.js
5. Open in browser
http://localhost:5001
