import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env copy' });

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
      ca: fs.readFileSync(path.resolve(process.env.DB_SSL_CA || 'isrgrootx1.pem')),
      rejectUnauthorized: true
  }
};

const pool = mysql.createPool(dbConfig);

async function initDB() {
  try {
      await pool.query(`
         CREATE TABLE IF NOT EXISTS coldcall_customers (
             id VARCHAR(255) PRIMARY KEY,
             customerNo INT,
             name VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
             phone VARCHAR(50),
             additionalPhones JSON,
             stage VARCHAR(50),
             status VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
             source VARCHAR(50),
             responsibleId VARCHAR(255),
             bot_ratingText VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
             bot_score INT,
             q1_business TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
             q2_usage TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
             q3_sample TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
             q4_visit TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
             q5_prefTime TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
             q6_addLine TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
             created_at DATETIME,
             updated_at DATETIME
         );
      `);
     await pool.query(`
        CREATE TABLE IF NOT EXISTS coldcall_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            adminId VARCHAR(255),
            adminName VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
            customerId VARCHAR(255),
            customerName VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
            customerPhone VARCHAR(50),
            customerStage VARCHAR(50),
            action VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
            type VARCHAR(50),
            details TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
            duration INT,
            snapshot JSON,
            timestamp DATETIME
        );
     `);
     // Create dummy topics table
     await pool.query(`
        CREATE TABLE IF NOT EXISTS coldcall_topics (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
            isActive BOOLEAN DEFAULT TRUE,
            createdAt DATETIME
        );
     `);
     // Demo Seed for Topic if empty
     const [rows] = await pool.query('SELECT COUNT(*) as c FROM coldcall_topics');
     if (rows[0].c === 0) {
         await pool.query('INSERT INTO coldcall_topics (title, createdAt) VALUES (?, NOW())', ['บทสนทนาทั่วไป']);
     }
      // 4. USERS TABLE
      await pool.query(`
        CREATE TABLE IF NOT EXISTS coldcall_users (
            id VARCHAR(50) PRIMARY KEY,
            username VARCHAR(100), -- Will store Email
            password VARCHAR(100),
            name VARCHAR(100),
            role VARCHAR(20),
            currentStatus VARCHAR(20) DEFAULT 'offline',
            lastActive DATETIME,
            color VARCHAR(20)
        )
      `);

      // Seed Admins (Always ensure core team is present and updated)
      console.log('🌱 Updating Admin Accounts in TiDB...');
      await pool.query(`
          REPLACE INTO coldcall_users (id, username, password, name, role, color) VALUES
          ('m1', 'basil@coldcall.com', '1234', 'Manager Basil', 'manager', '#4F46E5'),
          ('a1', 'khaofang@coldcall.com', '1234', 'ข้าวฟ่าง', 'admin', '#E9D5FF'),
          ('a2', 'tim@coldcall.com', '1234', 'ทิม', 'admin', '#374151'),
          ('a3', 'thee@coldcall.com', '1234', 'ธีร์', 'admin', '#DCFCE7'),
          ('a4', 'nice@coldcall.com', '1234', 'ไนซ์', 'admin', '#FEE2E2'),
          ('a5', 'ploy@coldcall.com', '1234', 'พลอย', 'admin', '#FEF3C7'),
          ('a6', 'toey@coldcall.com', '1234', 'Toey', 'admin', '#DBEAFE')
      `);
      console.log('✅ Server TiDB Database Initialized Successfully');
  } catch (error) {
      console.error('❌ Failed to initialize tables', error);
      process.exit(1); // Exit if DB init fails
  }
}

// Start Server AFTER DB is ready
initDB().then(() => {
    const PORT = 3001;
    // 10. Database Maintenance (Reset & Seed)
app.post('/api/setup/reset', async (req, res) => {
    try {
        console.log('🧹 Resetting Database (Customers & Logs)...');
        await pool.query('TRUNCATE TABLE coldcall_logs');
        await pool.query('TRUNCATE TABLE coldcall_customers');
        res.json({ success: true, message: 'Database reset successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/setup/seed', async (req, res) => {
    try {
        console.log('🌱 Starting Demo Seeding...');
        
        const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
        const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
        const bizNames = ["ก้าวหน้า","รุ่งเรือง","มั่งคั่ง","ทวีโชค","ไทยเจริญ","สยาม","สมบูรณ์","โชคชัย","มณีรัตน์","พรประเสริฐ","วิวัฒน์","เจริญทรัพย์","ภูมิใจ","นวัตกรรม","ทองดี","สุขใจ","เพชรทอง","เอกชัย","ศิริมงคล","อนันต์"];
        const bizTypes = ["พลาสติก","วิศวกรรม","เคหะภัณฑ์","การไฟฟ้า","โลหะการ","ก่อสร้าง","เอ็นจิเนียริ่ง","เทรดดิ้ง","ซัพพลาย","อุตสาหกรรม","ออโตเมชั่น","เซอร์วิส","กรุ๊ป","อินเตอร์","โฮลดิ้ง"];
        const outcomes = ["ลูกค้าไม่รับสาย","คุยข้อมูลเบื้องต้น","ขอใบเสนอราคา","ส่งแคตตาล็อกแล้ว","นัดคุยเพิ่ม"];
        
        // Get existing admins
        const [admins] = await pool.query("SELECT id, name FROM coldcall_users WHERE role = 'admin'");
        
        // 1. Create 300 Customers
        console.log('  Adding 300 Customers...');
        for (let i = 0; i < 300; i++) {
            const stage = i < 80 ? 'pool' : (i < 200 ? 'qualified' : 'customer');
            const admin = stage === 'pool' ? null : pick(admins);
            const name = stage === 'pool' ? '' : `${pick(["บจก.", "หจก.", "ร้าน"])} ${pick(bizNames)} ${pick(bizTypes)}`;
            const phone = `0${rand(6, 9)}${rand(10000000, 99999999)}`;
            const docId = `pool_${phone}`;
            
            await pool.query(`
                INSERT INTO coldcall_customers (id, name, phone, stage, responsibleId, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
            `, [
                docId, name, phone, stage, 
                admin?.id || null,
                stage === 'customer' ? '✅ ปิดดีลสำเร็จ (Closed Won)' : (stage === 'qualified' ? '⏳ รอการตัดสินใจ (Pending)' : '🆕 รอดำเนินการ')
            ]);
        }

        // 2. Create some basic logs
        console.log('  Generating Activity Logs...');
        const [newCusts] = await pool.query("SELECT id, name, phone, stage FROM coldcall_customers WHERE stage != 'pool' LIMIT 100");
        
        for (const cust of newCusts) {
            const admin = pick(admins);
            await pool.query(`
                INSERT INTO coldcall_logs (adminId, adminName, customerId, customerName, customerPhone, customerStage, action, type, details, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `, [
                admin.id, admin.name, cust.id, cust.name, cust.phone, cust.stage,
                pick(['โทรติดตามลูกค้า', 'บันทึกข้อมูล', 'ส่งเอกสาร']),
                pick(['call', 'save']),
                pick(outcomes)
            ]);
        }

        res.json({ success: true, message: 'Demo data seeded successfully (300 customers, 100 logs)' });
    } catch (err) {
        console.error('❌ Seeding Error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
        console.log(`🚀 Backend Services running on http://localhost:${PORT} (TiDB Connected)`);
    });
});

// HELPER
const safeTimestamp = (doc) => {
    return { ...doc, timestamp: doc.timestamp ? new Date(doc.timestamp).toISOString() : new Date().toISOString() };
};

// 1. Get Customers By Stage with Pagination
app.get('/api/customers', async (req, res) => {
    try {
        const { stage, adminId, limit = 100, page = 1, phone } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        let query = 'SELECT * FROM coldcall_customers WHERE 1=1';
        let countQuery = 'SELECT COUNT(*) as total FROM coldcall_customers WHERE 1=1';
        const params = [];
        const countParams = [];
        
        if (stage && stage !== 'all') {
            query += ' AND stage = ?';
            countQuery += ' AND stage = ?';
            params.push(stage);
            countParams.push(stage);
        }

        if (adminId) {
            query += ' AND responsibleId = ?';
            countQuery += ' AND responsibleId = ?';
            params.push(adminId);
            countParams.push(adminId);
        }

        if (phone) {
            query += ' AND (phone LIKE ? OR CAST(additionalPhones AS CHAR) LIKE ?)';
            countQuery += ' AND (phone LIKE ? OR CAST(additionalPhones AS CHAR) LIKE ?)';
            const searchPattern = `%${phone}%`;
            params.push(searchPattern, searchPattern);
            countParams.push(searchPattern, searchPattern);
        }
        
        // Get Total Count
        const [countResult] = await pool.query(countQuery, countParams);
        const total = countResult[0].total;

        // Get Paginated Data
        query += ' ORDER BY id ASC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [rows] = await pool.query(query, params);
        
        // Format to match frontend expectations
        const formatted = rows.map(r => ({
            ...r,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            additionalPhones: r.additionalPhones ? (typeof r.additionalPhones === 'string' ? JSON.parse(r.additionalPhones) : r.additionalPhones) : []
        }));
        
        res.json({
            data: formatted,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        console.error('❌ API Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 1.1 Stats for Dashboard (Comprehensive)
app.get('/api/customers/stats', async (req, res) => {
    try {
        const { adminId } = req.query;
        
        // 1. Main Stage Counts
        let stageQuery = `
            SELECT 
                CAST(COUNT(CASE WHEN stage = 'pool' THEN 1 END) AS UNSIGNED) as pool,
                CAST(COUNT(CASE WHEN stage = 'qualified' THEN 1 END) AS UNSIGNED) as qualified,
                CAST(COUNT(CASE WHEN stage = 'customer' THEN 1 END) AS UNSIGNED) as customer,
                CAST(COUNT(*) AS UNSIGNED) as total
            FROM coldcall_customers
        `;
        if (adminId) stageQuery += ' WHERE responsibleId = ?';
        const [stageRows] = await pool.query(stageQuery, [adminId]);
        const stats = stageRows[0] || { pool: 0, qualified: 0, customer: 0, total: 0 };

        // 2. Online Admins Count (Only count users with role 'admin')
        const [onlineRows] = await pool.query("SELECT COUNT(*) as activeAdmins FROM coldcall_users WHERE currentStatus = 'online' AND role = 'admin'");
        const [onlineNames] = await pool.query("SELECT name FROM coldcall_users WHERE currentStatus = 'online' AND role = 'admin'");
        stats.activeAdmins = Number(onlineRows[0].activeAdmins || 0);
        console.log(`🔍 Online Admins List: ${onlineNames.map(u => u.name).join(', ') || 'None'}`);

        // 3. New Leads Today (Skipped or dummy for now to avoid crash)
        stats.newLeadsToday = 0; 
        try {
            // ลองนับแบบไม่ระบุวันที่ไปก่อน หรือถ้าคุณมีคอลัมน์อื่นแจ้งผมได้ครับ
            const [newLeadsRows] = await pool.query("SELECT COUNT(*) as c FROM coldcall_customers");
            stats.newLeadsTotal = Number(newLeadsRows[0].c || 0);
        } catch (e) {
            console.error('⚠️ Could not count customers:', e.message);
        }

        // 4. Weekly Stats & Leaderboard (Last 7 Days)
        const [weeklyLogs] = await pool.query(`
            SELECT l.adminId, l.adminName, l.type, l.customerStage 
            FROM coldcall_logs l
            JOIN coldcall_users u ON l.adminId = u.id
            WHERE l.timestamp >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            ${adminId ? 'AND l.adminId = ?' : ''}
        `);

        const adminMap = {};
        weeklyLogs.forEach(l => {
            if (!adminMap[l.adminId]) adminMap[l.adminId] = { id: l.adminId, name: l.adminName, followed: 0, converted: 0 };
            if (l.type === 'call' || l.type === 'save') adminMap[l.adminId].followed++;
            if (l.type === 'save' && l.customerStage === 'customer') adminMap[l.adminId].converted++;
        });

        const leaderboard = Object.values(adminMap)
            .map(a => ({
                ...a,
                rate: a.followed > 0 ? Math.round((a.converted / a.followed) * 100) + '%' : '0%'
            }))
            .sort((a, b) => b.converted - a.converted)
            .slice(0, 5);

        const adminDetails = {};
        Object.values(adminMap).forEach(a => {
            const rateNum = a.followed > 0 ? (a.converted / a.followed) * 100 : 0;
            adminDetails[a.id] = {
                grade: rateNum >= 15 ? 'A' : (rateNum >= 5 ? 'B' : 'C'),
                followed: a.followed,
                converted: a.converted,
                rate: Math.round(rateNum) + '%'
            };
        });

        stats.weeklyStats = {
            efficiency: stats.total > 0 ? Math.round(((stats.customer || 0) / stats.total) * 100) + '%' : '0%',
            efficiencyGrowth: '+5',
            followUps: Number(weeklyLogs.filter(l => l.type === 'call').length),
            followUpsTotal: Number(stageRows[0].qualified || 0), // สมมติว่าลีดที่ qualified คือลีดที่ต้องเตรียมติดตาม
            followUpsGrowth: '+12',
            newCustomers: Number(weeklyLogs.filter(l => l.type === 'save' && l.customerStage === 'customer').length),
            newCustomersGrowth: '+8',
            leaderboard,
            adminDetails
        };

        // 5. Activity Trend (Last 7 Days)
        const [trendRows] = await pool.query(`
            SELECT DATE_FORMAT(timestamp, '%d/%m') as date, COUNT(*) as count 
            FROM coldcall_logs 
            WHERE timestamp >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY DATE_FORMAT(timestamp, '%d/%m')
            ORDER BY MIN(timestamp)
        `);
        stats.activityTrend = {
            labels: trendRows.map(r => r.date),
            counts: trendRows.map(r => r.count.toString())
        };

        console.log(`📊 Stats Payload: Online=${stats.activeAdmins}, LeadsToday=${stats.newLeadsToday}`);
        res.json(stats);
    } catch (err) {
        console.error('❌ Stats Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 2. Fetch/Create Topics
app.get('/api/topics', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM coldcall_topics WHERE isActive = TRUE');
        res.json(rows.map(r => ({ ...r, id: r.id.toString() })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/topics', async (req, res) => {
    try {
        const { title } = req.body;
        const [result] = await pool.query(
            'INSERT INTO coldcall_topics (title, isActive, createdAt) VALUES (?, TRUE, NOW())',
            [title]
        );
        res.json({ success: true, id: result.insertId.toString() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Log Activity
app.post('/api/logs', async (req, res) => {
    try {
        const d = req.body;
        const now = new Date();
        const timestamp = d.timestamp ? new Date(d.timestamp) : now;
        
        // Log all fields for debugging if 500 occurs
        // console.log('Logging activity:', d.action, 'for', d.customerName);

        const snapshotJson = (d.snapshot && typeof d.snapshot === 'object') ? JSON.stringify(d.snapshot) : (typeof d.snapshot === 'string' ? d.snapshot : null);
        
        const [result] = await pool.query(`
            INSERT INTO coldcall_logs 
            (adminId, adminName, customerId, customerName, customerPhone, customerStage, action, type, details, duration, snapshot, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            d.adminId || 'unknown', 
            d.adminName || 'Unknown', 
            d.customerId || '', 
            d.customerName || '', 
            d.customerPhone || '', 
            d.customerStage || '', 
            d.action || '', 
            d.type || 'info', 
            d.details || '', 
            d.duration || null, 
            snapshotJson, 
            timestamp
        ]);

        res.json({ success: true, id: result.insertId.toString() });
    } catch (err) {
        console.error('❌ Log Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 4. Update Customer Fields (e.g. status)
app.patch('/api/customers/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        if (Object.keys(updates).length === 0) return res.json({ success: true });
        const setClauses = [];
        const params = [];
        for (const [key, value] of Object.entries(updates)) {
            const dbKey = key === 'updatedAt' ? 'updated_at' : (key === 'createdAt' ? 'created_at' : key);
            setClauses.push(`${dbKey} = ?`);
            params.push(value);
        }
        params.push(id);
        const query = `UPDATE coldcall_customers SET ${setClauses.join(', ')} WHERE id = ?`;
        await pool.query(query, params);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// 4.1 Bulk Assign Customers
app.post('/api/customers/bulk-assign', async (req, res) => {
    try {
        const { ids, responsibleId, responsibleName } = req.body;
        if (!ids || !ids.length) return res.json({ success: true });
        
        await pool.query(
            'UPDATE coldcall_customers SET responsibleId = ?, responsibleName = ?, updated_at = NOW() WHERE id IN (?)',
            [responsibleId, responsibleName, ids]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// 5. Get Customer Logs
app.get('/api/logs/customer/:customerId', async (req, res) => {
    try {
        const { limit } = req.query;
        const limitCount = limit ? parseInt(limit) : 10;
        const [rows] = await pool.query(
            'SELECT * FROM coldcall_logs WHERE customerId = ? ORDER BY timestamp DESC LIMIT ?',
            [req.params.customerId, limitCount]
        );
        res.json(rows.map(safeTimestamp));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Get Admin Logs within Date Range (Critical for Dashboard!)
app.get('/api/logs/admin', async (req, res) => {
    try {
        const { adminId, startDate, endDate, type, limit } = req.query;
        let q = 'SELECT * FROM coldcall_logs WHERE 1=1';
        const params = [];

        if (adminId) { q += ' AND adminId = ?'; params.push(adminId); }
        if (startDate) { q += ' AND timestamp >= ?'; params.push(new Date(startDate)); }
        if (endDate) { q += ' AND timestamp < ?'; params.push(new Date(endDate)); }
        if (type) { q += ' AND type = ?'; params.push(type); }

        q += ' ORDER BY timestamp DESC';
        if (limit) { q += ' LIMIT ?'; params.push(parseInt(limit)); }

        const [rows] = await pool.query(q, params);
        res.json(rows.map(safeTimestamp));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// 7. Get All Logs within range (For general stats Dashboard)
app.get('/api/logs/all', async (req, res) => {
    try {
        const { startDate, endDate, limit } = req.query;
        let q = 'SELECT * FROM coldcall_logs WHERE 1=1';
        const params = [];
        if (startDate) { q += ' AND timestamp >= ?'; params.push(new Date(startDate)); }
        if (endDate) { q += ' AND timestamp < ?'; params.push(new Date(endDate)); }
        
        q += ' ORDER BY timestamp DESC';
        if (limit) { q += ' LIMIT ?'; params.push(parseInt(limit)); }

        const [rows] = await pool.query(q, params);
        res.json(rows.map(safeTimestamp));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// 8. Get Users (Admins)
app.get('/api/users', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM coldcall_users');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 9. Update User (Used for both status and admin management)
app.patch('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const setClauses = [];
        const params = [];
        
        // Allowed fields for patch/update
        const allowedFields = ['name', 'username', 'password', 'role', 'color', 'currentStatus'];
        
        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                setClauses.push(`${key} = ?`);
                params.push(value);
                if (key === 'currentStatus') {
                    setClauses.push("lastActive = NOW()");
                }
            }
        }
        
        if (setClauses.length === 0) return res.json({ success: true });
        
        params.push(id);
        const query = `UPDATE coldcall_users SET ${setClauses.join(', ')} WHERE id = ?`;
        
        await pool.query(query, params);
        res.json({ success: true });
    } catch (err) {
        console.error('❌ User Update Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 9.1 Create New User
app.post('/api/users', async (req, res) => {
    try {
        const { username, password, name, role, color } = req.body;
        
        // Generate next ID if not provided (e.g., a7, a8...)
        let { id } = req.body;
        if (!id) {
            const [rows] = await pool.query("SELECT id FROM coldcall_users WHERE id LIKE 'a%' ORDER BY CAST(SUBSTRING(id, 2) AS UNSIGNED) DESC LIMIT 1");
            const lastId = rows[0]?.id || 'a0';
            const num = parseInt(lastId.substring(1)) + 1;
            id = `a${num}`;
        }

        await pool.query(
            'INSERT INTO coldcall_users (id, username, password, name, role, color, currentStatus) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, username, password, name, role || 'admin', color || '#374151', 'offline']
        );
        res.json({ success: true, id });
    } catch (err) {
        console.error('❌ User Create Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 9.2 Delete User
app.delete('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // 1. Unassign their customers first
        await pool.query('UPDATE coldcall_customers SET responsibleId = NULL, responsibleName = "Unassigned" WHERE responsibleId = ?', [id]);
        
        // 2. Delete the user
        await pool.query('DELETE FROM coldcall_users WHERE id = ?', [id]);
        
        res.json({ success: true });
    } catch (err) {
        console.error('❌ User Delete Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 10. Activity Trend Stats (For Velocity calculation)
app.get('/api/logs/stats/trend', async (req, res) => {
    try {
        const { adminId } = req.query;
        let q = 'SELECT type, COUNT(*) as count FROM coldcall_logs WHERE timestamp >= CURDATE()';
        const params = [];
        if (adminId && adminId !== 'all') {
            q += ' AND adminId = ?';
            params.push(adminId);
        }
        q += ' GROUP BY type';
        
        const [rows] = await pool.query(q, params);
        const result = {};
        rows.forEach(r => result[r.type] = r.count);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Global Error Handler to prevent crash
app.use((err, req, res, next) => {
    console.error('💥 Unhandled Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('☠️ Uncaught Exception:', err);
});
