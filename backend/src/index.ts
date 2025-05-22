import express, { json, response } from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { createClient } from "redis";
import dotenv from "dotenv";
import livereload from 'livereload';
import connectLiveReload from 'connect-livereload';
import session from 'express-session';
// Middleware để TypeScript nhận diện session
declare module 'express-session' {
  interface Session {
    currentuser: string|undefined; // Khai báo kiểu dữ liệu cho giá trị lưu trong session
  }
}

dotenv.config({ path: path.resolve(__dirname, '../.env') });
const client = createClient({
  username: "default",
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST as string,
    port: process.env.REDIS_PORT as unknown as number,
  },
});
// Khởi tạo LiveReload server
const liveReloadServer = livereload.createServer();

liveReloadServer.server.once("connection", () => {
  setTimeout(() => {
    liveReloadServer.refresh("/");
  }, 100);
});

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(connectLiveReload()); // Middleware để inject LiveReload script
// Cấu hình session
app.use(session({
  secret: 'your-secret-key', // Chuỗi bí mật để mã hóa session
  resave: false, // Không lưu lại session nếu không thay đổi
  saveUninitialized: false, // Không tạo session cho đến khi có dữ liệu
  cookie: { secure: false } // Đặt true nếu dùng HTTPS
}));

//get ds tin nhắn
app.get("/getMessages", async (req, res) => {
    const savedValue = req.session.currentuser;

  if (client.isOpen) {
    res.json(await getMessages(savedValue));
  } else {
    client.connect().then(async () => {
      res.json(await getMessages(savedValue));
    });
  }
});
//login là trang mặc định
app.get("/", async (req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/login.html"));
});
//login 
app.get("/login", async (req, res) => {
  const account = req.query.account as string;
  const password = req.query.password as string;
  let username
  if (!client.isOpen) {
    await client.connect().then(async () => {
      username=await Login(res,account,password);
    });
  }else{
username=await Login(res,account,password);
  }
 req.session.currentuser =username
});
async function Login(res:any,account:string, password:string){
 let findPaulResult = (await client.ft.search(
    "idx:users",
    `@username:${account} @password:${password}`
  )) as {
    total: number;
    documents: {
      id: string;
    }[];
  };
  if (findPaulResult && findPaulResult.total > 0) {
    res.sendFile(path.join(__dirname, "../../frontend/index.html"));
    return account;
  }
}
async function getMessages(currentuser:string|undefined) {
  let result = "";
  let findPaulResult = (await client.ft.search("idx:messages", "*")) as {
    total: number;
    documents: {
      id: string;
      value: {
        from: string;
        message: string;
        date: string;
      };
    }[];
  };
  if (findPaulResult && findPaulResult.total) {
    findPaulResult.documents.forEach((doc) => {
      if(currentuser===doc.value.from){
       result +=  `<div class="row message-body">
          <div class="col-sm-12 message-main-sender">
                              <img class="avatar avatarR" height=50 width=50 src="https://bootdey.com/img/Content/avatar/avatar6.png">
            <div class="sender">
              <div class="message-text">
                              ${doc.value.message}

              </div>
              <span class="message-time pull-right">
                                 ${new Date(doc.value.date).toLocaleString()}

              </span>
            </div>
          </div>
        </div>`
      }
     else{
       result += `
         
         
        <div class="row message-body">
          <div class="col-sm-12 message-main-receiver">
             <img class="avatar" height=50 width=50 src="https://bootdey.com/img/Content/avatar/avatar6.png">
            <div class="receiver">
              <div class="message-text">
               ${doc.value.message}
              </div>
              <span class="message-time pull-right">
                                 ${new Date(doc.value.date).toLocaleString()}
              </span>
            </div>
          </div>
        </div>`;
     }
    });
    return result;
  }
}
app.use(express.static(path.join(__dirname, "../../frontend")));

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("chat message", (msg) => {
    io.emit("chat message", msg); // gửi cho tất cả
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
