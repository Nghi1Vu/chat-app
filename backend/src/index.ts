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
const app = express();
const server = http.createServer(app);
const io = new Server(server);

//get ds tin nhắn
app.get("/getMessages",async (req, res) =>{
debugger
if(client.isOpen){
  res.json(await getMessages());
}else{
client.connect().then(async()=>{

      res.json(await getMessages());
});
}

})
async function getMessages(){
    let result=''
  let findPaulResult = await client.ft.search("idx:messages", '*') as  {
  total: number;
  documents: {
    id: string;
    value: {
      from:string,
      message:string,
      date:string
    };
  }[];
};
if(findPaulResult&&findPaulResult.total){
  (findPaulResult.documents).forEach(doc => {
    result+=` <div class="row message-body">
          <div class="col-sm-12 message-main-receiver">
            <div class="receiver">
              <div class="message-text">
               ${doc.value.message}
              </div>
              <span class="message-time pull-right">
                 ${doc.value.date}
              </span>
            </div>
          </div>
        </div>`
});
return result
}}
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
