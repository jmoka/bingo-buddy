import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Estado das lives por partida
const liveStreams = new Map(); // partidaId => { broadcaster: socketId, viewers: Set<socketId> }

io.on("connection", (socket) => {
  console.log("Usuário conectado:", socket.id);

  // Entrar em uma partida específica
  socket.on("join-match", (matchId) => {
    socket.join(matchId);
    console.log(`Usuário ${socket.id} entrou na partida ${matchId}`);
  });

  // Admin inicia transmissão
  socket.on("start-live", (matchId) => {
    console.log(`Admin iniciou live para partida ${matchId}`);

    liveStreams.set(matchId, {
      broadcaster: socket.id,
      viewers: liveStreams.get(matchId)?.viewers ?? new Set(),
      isLive: true
    });

    // Notificar todos na partida que a live começou
    io.to(matchId).emit("live-started", { matchId, broadcaster: socket.id });
  });

  // Admin para transmissão
  socket.on("stop-live", (matchId) => {
    console.log(`Admin parou live para partida ${matchId}`);

    if (liveStreams.has(matchId)) {
      const stream = liveStreams.get(matchId);
      stream.isLive = false;

      // Notificar desconexão para viewers
      io.to(matchId).emit("live-stopped", { matchId });
    }
  });

  // Viewer solicita assistir
  socket.on("watch-live", (matchId) => {
    const stream = liveStreams.get(matchId);
    if (stream && stream.isLive) {
      stream.viewers.add(socket.id);
      socket.emit("can-watch", { matchId, broadcaster: stream.broadcaster });
      console.log(`Viewer ${socket.id} começou a assistir live da partida ${matchId}`);
    } else {
      socket.emit("live-not-available", { matchId });
    }
  });

  // WebRTC signaling
  socket.on("broadcaster", (matchId) => {
    socket.to(matchId).emit("broadcaster");
  });

  socket.on("watcher", (matchId) => {
    const stream = liveStreams.get(matchId);
    if (stream && stream.broadcaster) {
      socket.to(stream.broadcaster).emit("watcher", socket.id);
    }
  });

  socket.on("offer", (id, message) => {
    socket.to(id).emit("offer", socket.id, message);
  });

  socket.on("answer", (id, message) => {
    socket.to(id).emit("answer", socket.id, message);
  });

  socket.on("candidate", (id, message) => {
    socket.to(id).emit("candidate", socket.id, message);
  });

  socket.on("disconnect", () => {
    console.log("Usuário desconectado:", socket.id);

    // Remover viewer de todas as streams
    for (const [matchId, stream] of liveStreams.entries()) {
      if (stream.viewers.has(socket.id)) {
        stream.viewers.delete(socket.id);
        io.to(matchId).emit("viewer-disconnected", socket.id);
      }

      // Se o broadcaster desconectou, parar a live
      if (stream.broadcaster === socket.id) {
        stream.isLive = false;
        io.to(matchId).emit("live-stopped", { matchId, reason: "broadcaster-disconnected" });
      }
    }
  });
});

// Endpoint para verificar status da live
app.get("/api/live-status/:matchId", (req, res) => {
  const { matchId } = req.params;
  const stream = liveStreams.get(matchId);

  if (stream && stream.isLive) {
    res.json({
      isLive: true,
      viewerCount: stream.viewers.size,
      broadcaster: stream.broadcaster
    });
  } else {
    res.json({ isLive: false });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Servidor Socket.IO rodando na porta ${PORT}`);
});