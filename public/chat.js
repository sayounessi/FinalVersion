const socket = io();
let currentChat = ''; // Переменная для хранения текущего чата

// Функция для отображения чатов
function displayChats(chats) {
    const chatList = document.getElementById('chats');
    chatList.innerHTML = ''; // Очищаем список чатов

    chats.forEach(chat => {
        const chatItem = document.createElement('li');
        chatItem.innerText = chat;
        chatItem.onclick = () => joinChat(chat);
        chatList.appendChild(chatItem);
    });
}


function addUserToChat(chatId, userId) {
    fetch('/add-user-to-chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ chatId, userId })
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
    })
    .catch(error => {
        console.error('Ошибка при добавлении пользователя в чат:', error);
    });
}

function joinChat(chatName) {
    if (currentChat) {
        socket.emit('leaveChat', currentChat); 
    }
    currentChat = chatName;
    socket.emit('joinChat', chatName); 
    document.getElementById('current-chat').innerText = `Чат: ${chatName}`;
    document.getElementById('messages').innerHTML = ''; 
}

// Обработка получения сообщения
socket.on('receiveMessage', (message) => {
    const messagesDiv = document.getElementById('messages');
    const messageElement = document.createElement('div');
    messageElement.innerText = message;
    messagesDiv.appendChild(messageElement);
});

// Отправка сообщения
document.getElementById('send-message').onclick = function() {
    const messageInput = document.getElementById('message');
    const messageText = messageInput.value;

    if (messageText && currentChatId) {
        const messageData = {
            chatId: currentChatId,
            userId: userId, 
            message: messageText
        };
        socket.emit('sendMessage', messageData);
        messageInput.value = ''; // Очищаем поле ввода
    }
};
