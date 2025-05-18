import express, { json, response } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();
const client = createClient({
    username: 'default',
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST as string,
        port: ((process.env.REDIS_PORT as unknown) as number)
    }
});

// client.on('error', err => console.log('Redis Client Error', err));
// const val= {
// 				message : "xin chào",
// 				date : "",
// 				from : "nodejs"
// }
// client.connect().then(()=>{
// client.publish('chatroom_123',JSON.stringify(val));
// });

const app = express();
const server = http.createServer(app);
const io = new Server(server);

//get ds tin nhắn
app.get("/getMessages",(req, res) =>{
debugger
client.connect().then(async()=>{
let findPaulResult = await client.ft.search("idx:messages", '*') as any
if(findPaulResult&&findPaulResult.total){
// (findPaulResult.documents as Array<any>).forEach(doc => {
//     console.log(`ID: ${doc.id}, name: ${doc.value.from}, message: ${doc.value.message}, date: ${doc.value.date}`);
// });
      res.json(findPaulResult.documents);

}});


//client.keys
})

app.use(express.static(path.join(__dirname, '../../frontend')));

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('chat message', (msg) => {
    io.emit('chat message', msg); // gửi cho tất cả
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
