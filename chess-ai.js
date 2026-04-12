/**
 * Chess AI — Minimax with Alpha-Beta Pruning
 * Plays as the Black side against the user.
 */

class ChessAI {
    constructor(engine) {
        this.engine = engine;
        this.maxDepth = 3;

        // Piece values for evaluation
        this.pieceValues = {
            'p': 100,
            'n': 320,
            'b': 330,
            'r': 500,
            'q': 900,
            'k': 20000
        };

        // Piece-square tables for positional evaluation
        this.pst = this._buildPieceSquareTables();
    }

    /**
     * Find the best move for the current player (AI = black)
     */
    getBestMove() {
        const color = this.engine.turn;
        let bestMove = null;
        let bestScore = -Infinity;

        const moves = this._getAllMoves(color);

        // Sort moves for better alpha-beta pruning (captures first)
        moves.sort((a, b) => {
            const aCapture = this.engine.getPiece(a.toRow, a.toCol) ? 1 : 0;
            const bCapture = this.engine.getPiece(b.toRow, b.toCol) ? 1 : 0;
            return bCapture - aCapture;
        });

        for (const move of moves) {
            // Save state
            const state = this._saveState();

            // Try promotion
            let promoPiece = null;
            if (this.engine.needsPromotion(move.fromRow, move.fromCol, move.toRow)) {
                promoPiece = PIECE_TYPES.QUEEN; // AI always promotes to queen
            }

            this.engine.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol, promoPiece);

            const score = -this._negamax(this.maxDepth - 1, -Infinity, Infinity, color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE);

            // Restore state
            this._restoreState(state);

            if (score > bestScore) {
                bestScore = score;
                bestMove = { ...move, promotion: promoPiece };
            }
        }

        return bestMove;
    }

    _negamax(depth, alpha, beta, color) {
        if (depth === 0 || this.engine.gameOver) {
            const eval_ = this._evaluate();
            return color === COLORS.WHITE ? eval_ : -eval_;
        }

        const moves = this._getAllMoves(color);
        if (moves.length === 0) {
            if (this.engine.isInCheck(color)) {
                return -100000 + (this.maxDepth - depth); // Checkmate (closer = worse)
            }
            return 0; // Stalemate
        }

        // Sort for better pruning
        moves.sort((a, b) => {
            const aCapture = this.engine.getPiece(a.toRow, a.toCol) ? 1 : 0;
            const bCapture = this.engine.getPiece(b.toRow, b.toCol) ? 1 : 0;
            return bCapture - aCapture;
        });

        let bestScore = -Infinity;

        for (const move of moves) {
            const state = this._saveState();

            let promoPiece = null;
            if (this.engine.needsPromotion(move.fromRow, move.fromCol, move.toRow)) {
                promoPiece = PIECE_TYPES.QUEEN;
            }

            this.engine.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol, promoPiece);

            const nextColor = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
            const score = -this._negamax(depth - 1, -beta, -alpha, nextColor);

            this._restoreState(state);

            bestScore = Math.max(bestScore, score);
            alpha = Math.max(alpha, score);

            if (alpha >= beta) break; // Beta cutoff
        }

        return bestScore;
    }

    _evaluate() {
        let score = 0;

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.engine.board[r][c];
                if (!piece) continue;

                const value = this.pieceValues[piece.type];
                const pstValue = this._getPSTValue(piece, r, c);
                const total = value + pstValue;

                if (piece.color === COLORS.WHITE) {
                    score += total;
                } else {
                    score -= total;
                }
            }
        }

        // Mobility bonus
        const whiteMoves = this._countMoves(COLORS.WHITE);
        const blackMoves = this._countMoves(COLORS.BLACK);
        score += (whiteMoves - blackMoves) * 5;

        return score;
    }

    _countMoves(color) {
        let count = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.engine.board[r][c];
                if (p && p.color === color) {
                    // Count pseudo-legal moves quickly
                    count += this._quickMoveCount(p, r, c);
                }
            }
        }
        return count;
    }

    _quickMoveCount(piece, row, col) {
        let count = 0;
        switch (piece.type) {
            case PIECE_TYPES.PAWN: count = 2; break;
            case PIECE_TYPES.KNIGHT: count = 4; break;
            case PIECE_TYPES.BISHOP: count = 6; break;
            case PIECE_TYPES.ROOK: count = 7; break;
            case PIECE_TYPES.QUEEN: count = 12; break;
            case PIECE_TYPES.KING: count = 4; break;
        }
        return count;
    }

    _getAllMoves(color) {
        const moves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.engine.board[r][c];
                if (!piece || piece.color !== color) continue;

                const legalMoves = this.engine.getLegalMoves(r, c);
                for (const m of legalMoves) {
                    moves.push({
                        fromRow: r, fromCol: c,
                        toRow: m.row, toCol: m.col
                    });
                }
            }
        }
        return moves;
    }

    _saveState() {
        return {
            board: this.engine.board.map(row => row.map(cell => cell ? { ...cell } : null)),
            turn: this.engine.turn,
            castlingRights: { ...this.engine.castlingRights },
            enPassantSquare: this.engine.enPassantSquare ? { ...this.engine.enPassantSquare } : null,
            halfMoveClock: this.engine.halfMoveClock,
            fullMoveNumber: this.engine.fullMoveNumber,
            moveHistory: [...this.engine.moveHistory],
            capturedPieces: {
                w: [...this.engine.capturedPieces.w],
                b: [...this.engine.capturedPieces.b]
            },
            gameOver: this.engine.gameOver,
            gameResult: this.engine.gameResult,
            gameResultReason: this.engine.gameResultReason
        };
    }

    _restoreState(state) {
        this.engine.board = state.board;
        this.engine.turn = state.turn;
        this.engine.castlingRights = state.castlingRights;
        this.engine.enPassantSquare = state.enPassantSquare;
        this.engine.halfMoveClock = state.halfMoveClock;
        this.engine.fullMoveNumber = state.fullMoveNumber;
        this.engine.moveHistory = state.moveHistory;
        this.engine.capturedPieces = state.capturedPieces;
        this.engine.gameOver = state.gameOver;
        this.engine.gameResult = state.gameResult;
        this.engine.gameResultReason = state.gameResultReason;
    }

    _getPSTValue(piece, row, col) {
        // Use flipped tables for black
        const r = piece.color === COLORS.WHITE ? row : 7 - row;
        const table = this.pst[piece.type];
        if (!table) return 0;
        return table[r][col];
    }

    _buildPieceSquareTables() {
        return {
            'p': [
                [  0,  0,  0,  0,  0,  0,  0,  0],
                [ 50, 50, 50, 50, 50, 50, 50, 50],
                [ 10, 10, 20, 30, 30, 20, 10, 10],
                [  5,  5, 10, 25, 25, 10,  5,  5],
                [  0,  0,  0, 20, 20,  0,  0,  0],
                [  5, -5,-10,  0,  0,-10, -5,  5],
                [  5, 10, 10,-20,-20, 10, 10,  5],
                [  0,  0,  0,  0,  0,  0,  0,  0]
            ],
            'n': [
                [-50,-40,-30,-30,-30,-30,-40,-50],
                [-40,-20,  0,  0,  0,  0,-20,-40],
                [-30,  0, 10, 15, 15, 10,  0,-30],
                [-30,  5, 15, 20, 20, 15,  5,-30],
                [-30,  0, 15, 20, 20, 15,  0,-30],
                [-30,  5, 10, 15, 15, 10,  5,-30],
                [-40,-20,  0,  5,  5,  0,-20,-40],
                [-50,-40,-30,-30,-30,-30,-40,-50]
            ],
            'b': [
                [-20,-10,-10,-10,-10,-10,-10,-20],
                [-10,  0,  0,  0,  0,  0,  0,-10],
                [-10,  0, 10, 10, 10, 10,  0,-10],
                [-10,  5,  5, 10, 10,  5,  5,-10],
                [-10,  0,  5, 10, 10,  5,  0,-10],
                [-10,  5,  5,  5,  5,  5,  5,-10],
                [-10,  5,  0,  0,  0,  0,  5,-10],
                [-20,-10,-10,-10,-10,-10,-10,-20]
            ],
            'r': [
                [  0,  0,  0,  0,  0,  0,  0,  0],
                [  5, 10, 10, 10, 10, 10, 10,  5],
                [ -5,  0,  0,  0,  0,  0,  0, -5],
                [ -5,  0,  0,  0,  0,  0,  0, -5],
                [ -5,  0,  0,  0,  0,  0,  0, -5],
                [ -5,  0,  0,  0,  0,  0,  0, -5],
                [ -5,  0,  0,  0,  0,  0,  0, -5],
                [  0,  0,  0,  5,  5,  0,  0,  0]
            ],
            'q': [
                [-20,-10,-10, -5, -5,-10,-10,-20],
                [-10,  0,  0,  0,  0,  0,  0,-10],
                [-10,  0,  5,  5,  5,  5,  0,-10],
                [ -5,  0,  5,  5,  5,  5,  0, -5],
                [  0,  0,  5,  5,  5,  5,  0, -5],
                [-10,  5,  5,  5,  5,  5,  0,-10],
                [-10,  0,  5,  0,  0,  0,  0,-10],
                [-20,-10,-10, -5, -5,-10,-10,-20]
            ],
            'k': [
                [-30,-40,-40,-50,-50,-40,-40,-30],
                [-30,-40,-40,-50,-50,-40,-40,-30],
                [-30,-40,-40,-50,-50,-40,-40,-30],
                [-30,-40,-40,-50,-50,-40,-40,-30],
                [-20,-30,-30,-40,-40,-30,-30,-20],
                [-10,-20,-20,-20,-20,-20,-20,-10],
                [ 20, 20,  0,  0,  0,  0, 20, 20],
                [ 20, 30, 10,  0,  0, 10, 30, 20]
            ]
        };
    }
}
