const board = document.getElementById("board");

let selectedSquare = null;
let currentTurn = "white"; // NEW

const pieces = {
    r: "♜", n: "♞", b: "♝", q: "♛", k: "♚", p: "♟",
    R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔", P: "♙"
};

let boardState = [
    ["r","n","b","q","k","b","n","r"],
    ["p","p","p","p","p","p","p","p"],
    ["","","","","","","",""],
    ["","","","","","","",""],
    ["","","","","","","",""],
    ["","","","","","","",""],
    ["P","P","P","P","P","P","P","P"],
    ["R","N","B","Q","K","B","N","R"]
];

// Create board
function createBoard() {
    board.innerHTML = "";

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement("div");

            square.classList.add("square");
            square.classList.add((row + col) % 2 === 0 ? "white" : "black");

            square.dataset.row = row;
            square.dataset.col = col;

            const piece = boardState[row][col];
            if (piece) {
                square.textContent = pieces[piece];
            }

            square.addEventListener("click", handleClick);
            board.appendChild(square);
        }
    }
}

// Handle clicks
function handleClick(e) {
    const square = e.currentTarget; // FIX: always get square

    const row = parseInt(square.dataset.row);
    const col = parseInt(square.dataset.col);

    const piece = boardState[row][col];

    if (selectedSquare) {
        if (isValidMove(selectedSquare.row, selectedSquare.col, row, col)) {
            movePiece(selectedSquare.row, selectedSquare.col, row, col);
            currentTurn = currentTurn === "white" ? "black" : "white";
        }
        selectedSquare = null;
        createBoard();
    } else {
        if (piece !== "" && isCorrectTurn(piece)) {
            selectedSquare = { row, col };
            highlightSquare(row, col);
        }
    }
}

// Check turn
function isCorrectTurn(piece) {
    if (currentTurn === "white") {
        return piece === piece.toUpperCase();
    } else {
        return piece === piece.toLowerCase();
    }
}

// Move piece
function movePiece(fromRow, fromCol, toRow, toCol) {
    boardState[toRow][toCol] = boardState[fromRow][fromCol];
    boardState[fromRow][fromCol] = "";
}

// Pawn movement logic
function isValidMove(fromRow, fromCol, toRow, toCol) {
    const piece = boardState[fromRow][fromCol];

    // Only pawn logic for now
    if (piece.toLowerCase() !== "p") return false;

    const direction = piece === "P" ? -1 : 1; // white up, black down

    // Move forward
    if (fromCol === toCol && boardState[toRow][toCol] === "") {
        // 1 step
        if (toRow === fromRow + direction) return true;

        // 2 steps (starting position)
        if (
            (piece === "P" && fromRow === 6 && toRow === 4) ||
            (piece === "p" && fromRow === 1 && toRow === 3)
        ) return true;
    }

    // Capture diagonally
    if (
        Math.abs(fromCol - toCol) === 1 &&
        toRow === fromRow + direction &&
        boardState[toRow][toCol] !== ""
    ) {
        return true;
    }

    return false;
}

// Highlight selected
function highlightSquare(row, col) {
    createBoard();

    const index = row * 8 + col;
    document.getElementsByClassName("square")[index]
        .classList.add("highlight");
}

// Start
createBoard();