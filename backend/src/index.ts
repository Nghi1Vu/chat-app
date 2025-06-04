import express, { json, response, Response } from "express";
import http, { request } from "http";
import { Server } from "socket.io";
import path from "path";
import { createClient } from "redis";
import dotenv from "dotenv";
import livereload from "livereload";
import connectLiveReload from "connect-livereload";
import session from "express-session";
import { env, getuid } from "process";
import { v4 as uuidv4 } from "uuid";

// Middleware để TypeScript nhận diện session
declare module "express-session" {
  interface Session {
    currentuser: string | undefined; // Khai báo kiểu dữ liệu cho giá trị lưu trong session
  }
}

dotenv.config({ path: path.resolve(__dirname, "../.env") });
const client = createClient({
  username: "default",
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST as string,
    port: process.env.REDIS_PORT as unknown as number,
  },
});
const clientSub = createClient({
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

// Add body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(connectLiveReload()); // Middleware để inject LiveReload script
let ses = session({
  secret: "your-secret-key", // Chuỗi bí mật để mã hóa session
  resave: false, // Không lưu lại session nếu không thay đổi
  saveUninitialized: false, // Không tạo session cho đến khi có dữ liệu
  cookie: { secure: false }, // Đặt true nếu dùng HTTPS
});
// Cấu hình session
app.use(ses);
// Middleware chia sẻ session
io.use((socket, next) => {
  const req = socket.request as express.Request;
  const res = wrapRes();
  ses(req, res as any, next as any);
});

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
app.post("/login", async (req, res) => {
  const account = req.body.account as string;
  const password = req.body.password as string;
  let username;
  if (!client.isOpen) {
    await client.connect().then(async () => {
      username = await Login(res, account, password);
    });
  } else {
    username = await Login(res, account, password);
  }
  req.session.currentuser = username;
});
async function Login(res: Response, account: string, password: string) {
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
async function getMessages(currentuser: string | undefined) {
  let result = "";
  let findPaulResult = (await client.ft.search("idx:messages", "*",{ LIMIT: { from: 0, size: 10000 } })) as {
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
      if (currentuser === doc.value.from) {
        result += `<div class="row message-body">
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
        </div>`;
      } else {
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
async function getKey(type: string) {
  let valkey = "";
  await clientOpen(async () => {
    if (type === "message:") {
      valkey = uuidv4();

      while ((await client.exists(type + valkey)) > 0) {
        valkey = uuidv4();
      }
    }
  });
  return valkey;
}
async function clientOpen(func: Function) {
  if (!client.isOpen) {
    await client.connect().then(async () => {
      return func();
    });
  } else {
    return func();
  }
}
async function clientSubOpen(func: Function) {
  if (!clientSub.isOpen) {
    await clientSub.connect().then(async () => {
      return func();
    });
  } else {
    return func();
  }
}
async function saveMessage(from: string, message: string) {
  let obj = {
    from: from,
    message: message,
    date: new Date(Date.now()).toISOString(),
  } as any;
  await client.publish(process.env.REDIS_ROOM as string, JSON.stringify(obj));
  let key = await getKey("message:");
  await client.json.set(`message:${key}`, "$", obj);
}
app.use(express.static(path.join(__dirname, "../../frontend")));

io.on("connection", (socket) => {
  socket.on("chat message", async (msg) => {
    const req = socket.request as express.Request;
    if (!client.isOpen) {
      await client.connect().then(async () => {
        await saveMessage(req.session.currentuser as string, msg);
      });
    } else {
      await saveMessage(req.session.currentuser as string, msg);
    }

    io.emit(
      "chat message",
      `
          <div class="col-sm-12 message-main-sender">
                              <img class="avatar avatarR" height=50 width=50 src="https://bootdey.com/img/Content/avatar/avatar6.png">
            <div class="sender">
              <div class="message-text">
                              ${msg}

              </div>
              <span class="message-time pull-right">
                                 ${new Date(Date.now()).toLocaleString()}

              </span>
            </div>
          </div>
       `
    ); // gửi cho tất cả
  });
  clientSubOpen(async () => {
   await clientSub.unsubscribe(process.env.REDIS_ROOM as string);
   await clientSub.subscribe(process.env.REDIS_ROOM as string, (message) => {
      const req = socket.request as express.Request;

  const obj = JSON.parse(message);
  io.emit(
      "chat message",
  (req.session.currentuser === obj.from?`
          <div class="col-sm-12 message-main-sender">
                              <img class="avatar avatarR" height=50 width=50 src="https://bootdey.com/img/Content/avatar/avatar6.png">
            <div class="sender">
              <div class="message-text">
                              ${obj.message}

              </div>
              <span class="message-time pull-right">
                                 ${new Date(obj.date).toLocaleString()}

              </span>
            </div>
          </div>
       `:`
         
         
        <div class="row message-body">
          <div class="col-sm-12 message-main-receiver">
             <img class="avatar" height=50 width=50 src="https://bootdey.com/img/Content/avatar/avatar6.png">
            <div class="receiver">
              <div class="message-text">
               ${obj.message}
              </div>
              <span class="message-time pull-right">
                                 ${new Date(obj.date).toLocaleString()}
              </span>
            </div>
          </div>
        </div>`)
    ); // gửi cho tất cả
});
  });

  socket.on("disconnect", () => {});
});

function wrapRes() {
  // Only the end() method is required for express-session
  return {
    getHeader: () => {},
    setHeader: () => {},
    end: () => {},
    writeHead: () => {},
  };
}

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
