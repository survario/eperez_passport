import express from 'express';
import {router, productos} from './routes/productos.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Messages from './controllers/Messages.js'
import mongoose from 'mongoose';
import session from 'express-session'
import MongoStore from 'connect-mongo';

/*
mongoose.connect('mongodb://localhost:27017/ecommerce', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(()=> console.log('Conexión exitosa'))
    .catch(err => console.log(err))
*/

mongoose.connect('mongodb://localhost:27017/ecommerce', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(()=> console.log('Conexión exitosa'))
    .catch(err => console.log(err))

const messages = new Messages();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 8080;

const server = createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.use(session({
    store: MongoStore.create({
        mongoUrl: 'mongodb://localhost:27017/ecommerce',
        mongoOptions: { useNewUrlParser: true, useUnifiedTopology: true },
        ttl: 600
    }),
    secret: 'secreto',
    resave: false,
    saveUninitialized: false
}))

app.use((err, req, res, next) => {
    console.error(err.message);
    return res.status(500).send('Error de funcionamiento');
});

app.use('/api/', router);
app.use(express.static('public'));

app.set("view engine", "ejs");
app.set("views", "./views");

server.listen(PORT, () => {
    console.log(`Servidor levantado en el puerto http://localhost:${PORT}`);
});

server.on('error', error => {
    console.log('Error:', error);
});

// --------------- Desafio Log-In ---------------

const auth = (req, res, next) => {
    if (req.session.userName) {
        return next();
    } else {
        return res.sendFile(`${__dirname}/public/login.html`);
    }
};

app.get('/login',auth, (req, res) => {
    req.session.cookie.maxAge = 60000;
    res.sendFile(`${__dirname}/public/index.html`)
})

app.post('/login', (req, res) => {
    console.log(req.body.userName)
    req.session.userName = req.body.userName;
    res.send({userName: req.body.userName});
})

app.get('/username', (req, res) => {
    res.send({userName: req.session.userName});
})

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (!err) res.send('Logout ok!')
        else res.send({ status: 'Logout ERROR', body: err })
    })
}) 

app.get('*', (req, res) => {
    res.sendFile(`${__dirname}/public/warn.html`)
})

// ---------------------------------------------

io.on('connection', async (socket) => {

    const arrayMsg = await messages.getMessages();

    console.log('Cliente conectado');
    socket.emit('data', await productos.getProducts());
    socket.emit('messages', await messages.getMessages());
    
    socket.on('newProduct', async (data) => {
        io.sockets.emit('addProduct', await productos.getProducts());
    });

    socket.on('new-message', async (data) => {
        console.log('data', data)
            const newMsg = await messages.addMessage(data);
            io.sockets.emit('messages', await messages.getMessages());
    });
})