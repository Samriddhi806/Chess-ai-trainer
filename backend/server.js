const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// test route
app.get("/", (req, res) => {
    res.send("Chess Backend Running");
});

// move route
app.post("/move", (req, res) => {
    const { board } = req.body;

    console.log("Received board:", board);

    // TEMP AI (random move placeholder)
    res.json({
        move: "e2e4",
        message: "Sample move from backend"
    });
});

const PORT = 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});