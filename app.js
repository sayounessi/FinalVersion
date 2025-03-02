const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const mysql = require('mysql');
const cors = require('cors');

app.use(cors());
app.use(express.json());

// Создание подключения к базе данных
const db = mysql.createConnection({
    host: '10.70.2.107',
    user: 'root', // Замените на ваше имя пользователя
    password: '', // Замените на ваш пароль
    database: 'telegram_chat_app' // Имя вашей базы данных
});

// Подключение к базе данных
db.connect((err) => {
    if (err) {
        console.error('Ошибка подключения к базе данных:', err);
        return;
    }
    console.log('Подключение к базе данных успешно!');
});

// Замените 'YOUR_TELEGRAM_BOT_TOKEN' на токен вашего бота
const bot = new TelegramBot('7714783370:AAHeFnV7MTatIzDwQPNxX5KFDczgs4KTgB8', { polling: true });

let chats = {};
let users = {}; // Хранит пользователей с их Telegram ID и ролями

app.use(express.static('public'));
app.use(express.json());

// Обработка команды /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    // Проверка, зарегистрирован ли пользователь
    if (users[chatId]) {
        bot.sendMessage(chatId, `Вы уже зарегистрированы как ${users[chatId].name}, роль: ${users[chatId].role}, часовой пояс: ${users[chatId].timezone}.`);
        return;
    }

    bot.sendMessage(chatId, 'Добро пожаловать! Пожалуйста, введите ваше имя:');
    bot.once('message', (nameMsg) => {
        const userName = nameMsg.text; // Сохраняем имя пользователя
        users[chatId] = { id: chatId, name: userName }; // Сохраняем имя в объекте пользователей

        bot.sendMessage(chatId, 'Пожалуйста, выберите вашу роль:', {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Администратор', callback_data: 'role_admin' },
                        { text: 'Заказчик', callback_data: 'role_client' },
                        { text: 'Разработчик', callback_data: 'role_programmer' },
                        { text: 'Дизайнер', callback_data: 'role_designer' },
                        { text: 'Менеджер', callback_data: 'role_manager' }
                    ]
                ]
            }
        });
    });
});

// Обработка выбора роли
bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;

    // Проверка, зарегистрирован ли пользователь
    if (!users[chatId]) {
        bot.sendMessage(chatId, 'Пожалуйста, сначала зарегистрируйтесь, используя команду /start.');
        return;
    }

    const role = query.data.replace('role_', ''); // Убираем 'role_' из названия роли
    users[chatId].role = role; // Добавляем роль к пользователю

    bot.sendMessage(chatId, `Вы успешно зарегистрированы как ${users[chatId].name}, роль: ${role}! Пожалуйста, введите ваш часовой пояс (например, UTC+3):`);
    
    bot.once('message', (timezoneMsg) => {
        const timezone = timezoneMsg.text; // Сохраняем часовой пояс
        users[chatId].timezone = timezone; // Добавляем часовой пояс к пользователю

        // Теперь добавляем пользователя в базу данных
        const { id, name, role } = users[chatId];

        fetch('http://localhost:3000/create-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ telegramId: id, name, role, timezone })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                bot.sendMessage(chatId, `Вы успешно зарегистрированы! Ваше имя: ${name}, роль: ${role}, часовой пояс: ${timezone}. Теперь вы можете открыть веб-приложение по рядом со строкой ввода сообщений!`);
            }
        })
        .catch(error => {
            console.error('Ошибка при добавлении пользователя в базу данных:', error);
            bot.sendMessage(chatId, 'Произошла ошибка при регистрации. Пожалуйста, попробуйте позже.');
        });
    });
});

// Получение всех чатов
app.get('/get-chats', (req, res) => {
    const sql = 'SELECT * FROM chats'; // Запрос к базе данных для получения всех чатов

    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).send({ message: 'Ошибка при получении чатов' });
        }
        res.status(200).send(results); // Возвращаем результаты
    });
});

// Получение роли пользователя
app.get('/user-role/:userId', (req, res) => {
    const userId = req.params.userId;
    const user = users[userId];

    if (user) {
        res.status(200).send({ role: user.role });
    } else {
        res.status(404).send({ message: 'Пользователь не найден' });
    }
});

// Создание нового чата
app.post('/create-chat', (req, res) => {
    const { chatName } = req.body;
    const sql = 'INSERT INTO chats (name) VALUES (?)';

    db.query(sql, [chatName], (err, result) => {
        if (err) {
            return res.status(400).send({ message: 'Ошибка при создании чата' });
        }
        res.status(201).send({ message: 'Чат успешно создан' });

        // Добавление пользователя в чат после его создания
        const chatId = result.insertId; // Получаем ID созданного чата
        const userId = req.body.userId; // Получаем ID пользователя из запроса

        const sqlAddUser  = 'INSERT INTO chat_users (chat_id, user_id) VALUES (?, ?)';
        db.query(sqlAddUser , [chatId, userId], (err) => {
            if (err) {
                console.error('Ошибка при добавлении пользователя в чат:', err);
            } else {
                console.log(`Пользователь ${userId} добавлен в чат ${chatId}`);
            }
        });
    });
});

// Обработка подключения сокетов
io.on('connection', (socket) => {
    console.log('Новый пользователь подключен');

    socket.on('sendMessage', (data) => {
        const { chatId, userId, message } = data;
    
        // Сохраняем сообщение в базе данных
        const sql = 'INSERT INTO messages (chat_id, user_id, message) VALUES (?, ?, ?)';
        db.query(sql, [chatId, userId, message], (err, result) => {
            if (err) {
                console.error('Ошибка при сохранении сообщения:', err); // Логируем ошибку
                return; // Завершаем выполнение в случае ошибки
            }
    
            // Отправляем сообщение всем участникам чата
            io.to(chatId).emit('receiveMessage', { userId, message });
        });
    });

    socket.on('joinChat', (chatId) => {
        socket.join(chatId);
        console.log(`Пользователь присоединился к чату: ${chatId}`);
    });

    socket.on('disconnect', () => {
        console.log('Пользователь отключился');
    });
});

// Получение сообщений из чата
app.get('/get-messages/:chatId', (req, res) => {
    const chatId = req.params.chatId;
    const sql = 'SELECT messages.message, users.name AS userName FROM messages JOIN users ON messages.user_id = users.id WHERE messages.chat_id = ?';

    db.query(sql, [chatId], (err, results) => {
        if (err) {
            return res.status(400).send({ message: 'Ошибка при получении сообщений' });
        }
        res.status(200).send(results);
    });
});

app.post('/add-user-to-chat', (req, res) => {
    const { chatId, userId } = req.body;

    if (!userId) {
        return res.status(400).json({ message: 'User  ID cannot be null' });
    }

    const query = 'INSERT INTO chat_users (chat_id, user_id) VALUES (?, ?)';
    connection.query(query, [chatId, userId], (error, results) => {
        if (error) {
            console.error('Database error:', error);
            return res.status(500).json({ message: 'Error adding user to chat' });
        }
        res.status(200).json({ message: 'User  added to chat successfully' });
    });
});

app.post('/create-user', (req, res) => {
    const { telegramId, name, role, timezone } = req.body;

    const sql = 'INSERT INTO users (telegram_id, name, role, timezone) VALUES (?, ?, ?, ?)';
    db.query(sql, [telegramId, name, role, timezone], (err, result) => {
        if (err) {
            console.error('Ошибка при добавлении пользователя в базу данных:', err);
            return res.status(500).json({ message: 'Ошибка при добавлении пользователя' });
        }
        res.status(201).json({ message: 'Пользователь успешно добавлен' });
    });
});

// Запуск сервера
server.listen(3000, () => {
    console.log('Сервер запущен на http://localhost:3000');
});

// ───▄████▄────────────────
// ──███▄█▀─────────────────
// ─▐████──────▄──▄──▄──▄──▄    ОСТАЛЬНОЙ КОД ДОЕЛИ...
// ──█████▄─────────────────
// ───▀████▀────────────────