const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Estado do jogo
let gameState = {
  numerosSorteados: [],
  cronometro: 0,
  jogoAtivo: false,
  tempoRestante: 0,
  ultimoNumero: null
};

// Configurações do jogo
const CONFIG = {
  tempoPorRodada: 10, // segundos
  totalNumeros: 75
};

// Motor de sorteio
class MotorSorteio {
  constructor() {
    this.numerosDisponiveis = Array.from(
      { length: CONFIG.totalNumeros },
      (_, i) => i + 1
    );
    this.embaralhar();
  }

  embaralhar() {
    for (let i = this.numerosDisponiveis.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.numerosDisponiveis[i], this.numerosDisponiveis[j]] = [
        this.numerosDisponiveis[j],
        this.numerosDisponiveis[i]
      ];
    }
  }

  sortearNumero() {
    if (this.numerosDisponiveis.length === 0) {
      return null;
    }
    return this.numerosDisponiveis.pop();
  }

  resetar() {
    this.numerosDisponiveis = Array.from(
      { length: CONFIG.totalNumeros },
      (_, i) => i + 1
    );
    this.embaralhar();
  }
}

const motorSorteio = new MotorSorteio();

// Eventos Socket.IO
io.on("connection", (socket) => {
  console.log("Cliente conectado:", socket.id);

  // Envia estado atual ao cliente que se conecta
  socket.emit("estado-inicial", gameState);

  socket.on("disconnect", () => {
    console.log("Cliente desconectado:", socket.id);
  });

  // Eventos do admin
  socket.on("iniciar-jogo", () => {
    if (!gameState.jogoAtivo) {
      gameState.jogoAtivo = true;
      gameState.cronometro = CONFIG.tempoPorRodada;
      gameState.tempoRestante = CONFIG.tempoPorRodada;

      io.emit("jogo-iniciado", {
        tempoRestante: gameState.tempoRestante
      });

      iniciarCronometro();
    }
  });

  socket.on("pausar-jogo", () => {
    gameState.jogoAtivo = false;
    io.emit("jogo-pausado");
  });

  socket.on("continuar-jogo", () => {
    if (!gameState.jogoAtivo && gameState.numerosSorteados.length > 0) {
      gameState.jogoAtivo = true;
      io.emit("jogo-continuado", {
        tempoRestante: gameState.tempoRestante
      });
      iniciarCronometro();
    }
  });

  socket.on("resetar-jogo", () => {
    gameState = {
      numerosSorteados: [],
      cronometro: 0,
      jogoAtivo: false,
      tempoRestante: 0,
      ultimoNumero: null
    };
    motorSorteio.resetar();
    io.emit("jogo-resetado");
  });

  socket.on("sortear-numero-manual", () => {
    if (gameState.jogoAtivo) {
      sortearNumero();
    }
  });
});

// Função para sortear número
function sortearNumero() {
  const numero = motorSorteio.sortearNumero();

  if (numero !== null) {
    gameState.numerosSorteados.push(numero);
    gameState.ultimoNumero = numero;

    // Emite evento para todos os clientes
    io.emit("numero-sorteado", {
      numero: numero,
      numerosSorteados: gameState.numerosSorteados,
      totalSorteados: gameState.numerosSorteados.length
    });

    // Reset do cronômetro para próxima rodada
    gameState.cronometro = CONFIG.tempoPorRodada;
    gameState.tempoRestante = CONFIG.tempoPorRodada;

    // Verifica se acabaram os números
    if (gameState.numerosSorteados.length >= CONFIG.totalNumeros) {
      finalizarJogo();
    }
  }
}

// Função do cronômetro
function iniciarCronometro() {
  const intervalo = setInterval(() => {
    if (!gameState.jogoAtivo) {
      clearInterval(intervalo);
      return;
    }

    gameState.cronometro--;
    gameState.tempoRestante = gameState.cronometro;

    // Emite atualização do cronômetro
    io.emit("cronometro-atualizado", {
      tempoRestante: gameState.tempoRestante
    });

    // Sorteia número automaticamente quando o cronômetro chega a 0
    if (gameState.cronometro <= 0) {
      sortearNumero();
    }
  }, 1000);
}

// Finalizar jogo
function finalizarJogo() {
  gameState.jogoAtivo = false;
  io.emit("jogo-finalizado", {
    numerosSorteados: gameState.numerosSorteados,
    mensagem: "Todos os números foram sorteados!"
  });
}

// Rotas HTTP
app.get("/api/estado", (req, res) => {
  res.json(gameState);
});

app.post("/api/iniciar", (req, res) => {
  if (!gameState.jogoAtivo) {
    gameState.jogoAtivo = true;
    gameState.cronometro = CONFIG.tempoPorRodada;
    gameState.tempoRestante = CONFIG.tempoPorRodada;

    io.emit("jogo-iniciado", {
      tempoRestante: gameState.tempoRestante
    });

    iniciarCronometro();
    res.json({ sucesso: true, mensagem: "Jogo iniciado" });
  } else {
    res.json({ sucesso: false, mensagem: "Jogo já está em andamento" });
  }
});

app.post("/api/sortear", (req, res) => {
  if (gameState.jogoAtivo) {
    sortearNumero();
    res.json({ sucesso: true, mensagem: "Número sorteado" });
  } else {
    res.json({ sucesso: false, mensagem: "Jogo não está ativo" });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
