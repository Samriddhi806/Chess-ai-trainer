/**
 * Chess Engine — Handles all game rules, move validation, and illegal move detection.
 * Provides human-readable explanations for why a move is illegal.
 */

const PIECE_TYPES = {
    KING: 'k',
    QUEEN: 'q',
    ROOK: 'r',
    BISHOP: 'b',
    KNIGHT: 'n',
    PAWN: 'p'
};

const COLORS = {
    WHITE: 'w',
    BLACK: 'b'
};

// Unicode piece symbols
const PIECE_SYMBOLS = {
    'wk': '♔', 'wq': '♕', 'wr': '♖', 'wb': '♗', 'wn': '♘', 'wp': '♙',
    'bk': '♚', 'bq': '♛', 'br': '♜', 'bb': '♝', 'bn': '♞', 'bp': '♟'
};

const PIECE_NAMES = {
    'k': 'King', 'q': 'Queen', 'r': 'Rook', 'b': 'Bishop', 'n': 'Knight', 'p': 'Pawn'
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

class ChessEngine {
    constructor() {
        this.reset();
    }

    reset() {
        this.board = this._createInitialBoard();
        this.turn = COLORS.WHITE;
        this.castlingRights = { wK: true, wQ: true, bK: true, bQ: true };
        this.enPassantSquare = null;  // {row, col}
        this.halfMoveClock = 0;
        this.fullMoveNumber = 1;
        this.moveHistory = [];
        this.capturedPieces = { w: [], b: [] };
        this.gameOver = false;
        this.gameResult = null; // 'white', 'black', 'draw'
        this.gameResultReason = '';
        this.illegalMoveAttempts = []; // track all illegal move attempts
    }

    _createInitialBoard() {
        const board = Array(8).fill(null).map(() => Array(8).fill(null));

        // Place pieces
        const backRank = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

        for (let col = 0; col < 8; col++) {
            // Black pieces (rows 0-1)
            board[0][col] = { type: backRank[col], color: COLORS.BLACK };
            board[1][col] = { type: PIECE_TYPES.PAWN, color: COLORS.BLACK };

            // White pieces (rows 6-7)
            board[7][col] = { type: backRank[col], color: COLORS.WHITE };
            board[6][col] = { type: PIECE_TYPES.PAWN, color: COLORS.WHITE };
        }

        return board;
    }

    getPiece(row, col) {
        if (row < 0 || row > 7 || col < 0 || col > 7) return null;
        return this.board[row][col];
    }

    getPieceSymbol(piece) {
        if (!piece) return '';
        return PIECE_SYMBOLS[piece.color + piece.type];
    }

    squareToAlgebraic(row, col) {
        return FILES[col] + RANKS[7 - row];
    }

    algebraicToSquare(algebraic) {
        const col = FILES.indexOf(algebraic[0]);
        const row = 7 - RANKS.indexOf(algebraic[1]);
        return { row, col };
    }

    /**
     * Validates a move and returns { valid, reason }.
     * If not valid, `reason` is a human-readable explanation.
     */
    validateMove(fromRow, fromCol, toRow, toCol, promotionPiece = null) {
        const piece = this.getPiece(fromRow, fromCol);

        // Basic checks
        if (!piece) {
            return { valid: false, reason: 'There is no piece on the selected square.' };
        }

        if (piece.color !== this.turn) {
            const colorName = this.turn === COLORS.WHITE ? 'White' : 'Black';
            return { valid: false, reason: `It's ${colorName}'s turn. You cannot move your opponent's piece.` };
        }

        const target = this.getPiece(toRow, toCol);
        if (target && target.color === piece.color) {
            return { valid: false, reason: `You cannot capture your own ${PIECE_NAMES[target.type]}. You can only capture opponent pieces.` };
        }

        if (fromRow === toRow && fromCol === toCol) {
            return { valid: false, reason: 'You must move to a different square.' };
        }

        // Piece-specific movement validation
        const moveCheck = this._validatePieceMovement(piece, fromRow, fromCol, toRow, toCol);
        if (!moveCheck.valid) {
            return moveCheck;
        }

        // Check if move leaves own king in check
        const testBoard = this._cloneBoard();
        this._applyMoveToBoard(testBoard, fromRow, fromCol, toRow, toCol, promotionPiece);
        if (this._isKingInCheck(testBoard, piece.color)) {
            if (this._isKingInCheck(this.board, piece.color)) {
                return {
                    valid: false,
                    reason: `Your King is in check! You must make a move that gets your King out of check. Moving your ${PIECE_NAMES[piece.type]} to ${this.squareToAlgebraic(toRow, toCol)} does not resolve the check.`
                };
            } else {
                return {
                    valid: false,
                    reason: `Moving your ${PIECE_NAMES[piece.type]} from ${this.squareToAlgebraic(fromRow, fromCol)} to ${this.squareToAlgebraic(toRow, toCol)} would leave your King exposed to attack. This is called a "pin" — you cannot make a move that puts your own King in check.`
                };
            }
        }

        return { valid: true };
    }

    _validatePieceMovement(piece, fromRow, fromCol, toRow, toCol) {
        const dr = toRow - fromRow;
        const dc = toCol - fromCol;
        const absDr = Math.abs(dr);
        const absDc = Math.abs(dc);
        const target = this.getPiece(toRow, toCol);
        const pieceName = PIECE_NAMES[piece.type];
        const fromSq = this.squareToAlgebraic(fromRow, fromCol);
        const toSq = this.squareToAlgebraic(toRow, toCol);

        switch (piece.type) {
            case PIECE_TYPES.PAWN:
                return this._validatePawnMove(piece, fromRow, fromCol, toRow, toCol);

            case PIECE_TYPES.KNIGHT:
                if (!((absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2))) {
                    return {
                        valid: false,
                        reason: `A Knight moves in an "L" shape — 2 squares in one direction and 1 square perpendicular (or vice versa). The move from ${fromSq} to ${toSq} doesn't form an L-shape.`
                    };
                }
                return { valid: true };

            case PIECE_TYPES.BISHOP:
                if (absDr !== absDc) {
                    return {
                        valid: false,
                        reason: `A Bishop can only move diagonally. The move from ${fromSq} to ${toSq} is not along a diagonal line.`
                    };
                }
                if (this._isPathBlocked(fromRow, fromCol, toRow, toCol)) {
                    return {
                        valid: false,
                        reason: `Your Bishop's diagonal path from ${fromSq} to ${toSq} is blocked by another piece. Bishops cannot jump over other pieces.`
                    };
                }
                return { valid: true };

            case PIECE_TYPES.ROOK:
                if (dr !== 0 && dc !== 0) {
                    return {
                        valid: false,
                        reason: `A Rook can only move in straight lines — horizontally or vertically. The move from ${fromSq} to ${toSq} is diagonal, which is not allowed for a Rook.`
                    };
                }
                if (this._isPathBlocked(fromRow, fromCol, toRow, toCol)) {
                    return {
                        valid: false,
                        reason: `Your Rook's path from ${fromSq} to ${toSq} is blocked by another piece. Rooks cannot jump over other pieces.`
                    };
                }
                return { valid: true };

            case PIECE_TYPES.QUEEN:
                if (absDr !== absDc && dr !== 0 && dc !== 0) {
                    return {
                        valid: false,
                        reason: `A Queen can move horizontally, vertically, or diagonally — but the move from ${fromSq} to ${toSq} doesn't follow any of these lines. Make sure to move in a straight line.`
                    };
                }
                if (this._isPathBlocked(fromRow, fromCol, toRow, toCol)) {
                    return {
                        valid: false,
                        reason: `Your Queen's path from ${fromSq} to ${toSq} is blocked by another piece. The Queen cannot jump over other pieces.`
                    };
                }
                return { valid: true };

            case PIECE_TYPES.KING:
                return this._validateKingMove(piece, fromRow, fromCol, toRow, toCol);

            default:
                return { valid: false, reason: 'Unknown piece type.' };
        }
    }

    _validatePawnMove(piece, fromRow, fromCol, toRow, toCol) {
        const direction = piece.color === COLORS.WHITE ? -1 : 1;
        const startRow = piece.color === COLORS.WHITE ? 6 : 1;
        const dr = toRow - fromRow;
        const dc = toCol - fromCol;
        const absDc = Math.abs(dc);
        const target = this.getPiece(toRow, toCol);
        const fromSq = this.squareToAlgebraic(fromRow, fromCol);
        const toSq = this.squareToAlgebraic(toRow, toCol);

        // Moving backward
        if ((piece.color === COLORS.WHITE && dr > 0) || (piece.color === COLORS.BLACK && dr < 0)) {
            return {
                valid: false,
                reason: `Pawns cannot move backward! Pawns can only move forward (toward the opponent's side of the board).`
            };
        }

        // Forward move
        if (dc === 0) {
            if (dr === direction) {
                // One square forward
                if (target) {
                    return {
                        valid: false,
                        reason: `Pawns cannot capture by moving straight forward. Pawns capture diagonally, one square forward-left or forward-right.`
                    };
                }
                return { valid: true };
            }
            if (dr === 2 * direction && fromRow === startRow) {
                // Two squares forward from starting position
                if (target) {
                    return {
                        valid: false,
                        reason: `A Pawn cannot move two squares forward if there's a piece on the destination square.`
                    };
                }
                const middle = this.getPiece(fromRow + direction, fromCol);
                if (middle) {
                    return {
                        valid: false,
                        reason: `A Pawn cannot jump over a piece. There's a piece blocking the path at ${this.squareToAlgebraic(fromRow + direction, fromCol)}.`
                    };
                }
                return { valid: true };
            }
            if (dr === 2 * direction && fromRow !== startRow) {
                return {
                    valid: false,
                    reason: `A Pawn can only move two squares forward from its starting position (rank 2 for White, rank 7 for Black). Since your Pawn is no longer on its starting rank, it can only move one square forward.`
                };
            }
            return {
                valid: false,
                reason: `A Pawn can only move 1 square forward (or 2 squares from its starting position). Moving from ${fromSq} to ${toSq} covers too many squares.`
            };
        }

        // Diagonal capture
        if (absDc === 1 && dr === direction) {
            // En passant
            if (!target && this.enPassantSquare &&
                toRow === this.enPassantSquare.row && toCol === this.enPassantSquare.col) {
                return { valid: true };
            }
            if (!target) {
                return {
                    valid: false,
                    reason: `A Pawn can only move diagonally when capturing an opponent's piece. There's no piece at ${toSq} to capture.`
                };
            }
            return { valid: true };
        }

        return {
            valid: false,
            reason: `This is not a valid Pawn move. Pawns move straight forward (1 or 2 squares from start) and capture diagonally one square forward.`
        };
    }

    _validateKingMove(piece, fromRow, fromCol, toRow, toCol) {
        const dr = toRow - fromRow;
        const dc = toCol - fromCol;
        const absDr = Math.abs(dr);
        const absDc = Math.abs(dc);
        const fromSq = this.squareToAlgebraic(fromRow, fromCol);
        const toSq = this.squareToAlgebraic(toRow, toCol);

        // Castling
        if (absDc === 2 && dr === 0) {
            return this._validateCastling(piece, fromRow, fromCol, toCol);
        }

        if (absDr > 1 || absDc > 1) {
            return {
                valid: false,
                reason: `A King can only move one square in any direction. The move from ${fromSq} to ${toSq} is too far. (Exception: castling moves the King two squares toward a Rook.)`
            };
        }

        // Check if destination is attacked
        const testBoard = this._cloneBoard();
        this._applyMoveToBoard(testBoard, fromRow, fromCol, toRow, toCol);
        if (this._isKingInCheck(testBoard, piece.color)) {
            return {
                valid: false,
                reason: `You cannot move your King to ${toSq} because it would be under attack. A King can never move into check.`
            };
        }

        return { valid: true };
    }

    _validateCastling(piece, fromRow, fromCol, toCol) {
        const color = piece.color;
        const side = toCol > fromCol ? 'K' : 'Q'; // Kingside or Queenside
        const castlingKey = color + side;
        const sideName = side === 'K' ? 'kingside' : 'queenside';

        if (!this.castlingRights[castlingKey]) {
            return {
                valid: false,
                reason: `You cannot castle ${sideName}. ${side === 'K' ? 'Your King or kingside Rook' : 'Your King or queenside Rook'} has already moved, so castling is no longer available.`
            };
        }

        // Check if king is in check
        if (this._isKingInCheck(this.board, color)) {
            return {
                valid: false,
                reason: `You cannot castle while your King is in check. First, get out of check!`
            };
        }

        // Check path is clear
        const row = fromRow;
        const startCol = Math.min(fromCol, side === 'K' ? 7 : 0);
        const endCol = Math.max(fromCol, side === 'K' ? 7 : 0);
        for (let c = startCol + 1; c < endCol; c++) {
            if (this.board[row][c]) {
                return {
                    valid: false,
                    reason: `Cannot castle ${sideName} — there are pieces between your King and Rook. The path must be completely clear.`
                };
            }
        }

        // Check king doesn't pass through attacked square
        const direction = side === 'K' ? 1 : -1;
        for (let step = 0; step <= 2; step++) {
            const checkCol = fromCol + step * direction;
            const testBoard = this._cloneBoard();
            testBoard[row][checkCol] = piece;
            testBoard[row][fromCol] = step === 0 ? piece : null;
            if (step > 0 && this._isSquareAttacked(testBoard, row, checkCol, color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE)) {
                return {
                    valid: false,
                    reason: `Cannot castle ${sideName} — your King would pass through or land on a square that is under attack. The King cannot cross through check.`
                };
            }
        }

        return { valid: true };
    }

    _isPathBlocked(fromRow, fromCol, toRow, toCol) {
        const dr = Math.sign(toRow - fromRow);
        const dc = Math.sign(toCol - fromCol);
        let r = fromRow + dr;
        let c = fromCol + dc;

        while (r !== toRow || c !== toCol) {
            if (this.board[r][c]) return true;
            r += dr;
            c += dc;
        }
        return false;
    }

    /**
     * Get all legal moves for a piece at (row, col).
     * Returns array of {row, col, isCapture}.
     */
    getLegalMoves(row, col) {
        const piece = this.getPiece(row, col);
        if (!piece || piece.color !== this.turn) return [];

        const moves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const validation = this.validateMove(row, col, r, c);
                if (validation.valid) {
                    const target = this.getPiece(r, c);
                    const isEnPassant = piece.type === PIECE_TYPES.PAWN &&
                        this.enPassantSquare &&
                        r === this.enPassantSquare.row && c === this.enPassantSquare.col;
                    moves.push({
                        row: r,
                        col: c,
                        isCapture: (target !== null && target.color !== piece.color) || isEnPassant
                    });
                }
            }
        }
        return moves;
    }

    /**
     * Makes a move on the board. Assumes move is validated.
     * Returns move info for history.
     */
    makeMove(fromRow, fromCol, toRow, toCol, promotionPiece = null) {
        const piece = this.board[fromRow][fromCol];
        const captured = this.board[toRow][toCol];
        const moveInfo = {
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol },
            piece: { ...piece },
            captured: captured ? { ...captured } : null,
            notation: '',
            castling: null,
            enPassant: false,
            promotion: promotionPiece,
            prevEnPassant: this.enPassantSquare,
            prevCastling: { ...this.castlingRights },
            prevHalfMoveClock: this.halfMoveClock
        };

        // En passant capture
        if (piece.type === PIECE_TYPES.PAWN && this.enPassantSquare &&
            toRow === this.enPassantSquare.row && toCol === this.enPassantSquare.col) {
            const capturedRow = piece.color === COLORS.WHITE ? toRow + 1 : toRow - 1;
            moveInfo.captured = { ...this.board[capturedRow][toCol] };
            moveInfo.enPassant = true;
            this.board[capturedRow][toCol] = null;
        }

        // Castling
        if (piece.type === PIECE_TYPES.KING && Math.abs(toCol - fromCol) === 2) {
            const side = toCol > fromCol ? 'K' : 'Q';
            moveInfo.castling = side;
            const rookFromCol = side === 'K' ? 7 : 0;
            const rookToCol = side === 'K' ? 5 : 3;
            this.board[fromRow][rookToCol] = this.board[fromRow][rookFromCol];
            this.board[fromRow][rookFromCol] = null;
        }

        // Move piece
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;

        // Pawn promotion
        if (piece.type === PIECE_TYPES.PAWN && (toRow === 0 || toRow === 7)) {
            if (promotionPiece) {
                this.board[toRow][toCol] = { type: promotionPiece, color: piece.color };
            }
            // If no promotion piece specified, caller should handle promotion UI
        }

        // Update en passant square
        if (piece.type === PIECE_TYPES.PAWN && Math.abs(toRow - fromRow) === 2) {
            this.enPassantSquare = {
                row: (fromRow + toRow) / 2,
                col: fromCol
            };
        } else {
            this.enPassantSquare = null;
        }

        // Update castling rights
        if (piece.type === PIECE_TYPES.KING) {
            if (piece.color === COLORS.WHITE) {
                this.castlingRights.wK = false;
                this.castlingRights.wQ = false;
            } else {
                this.castlingRights.bK = false;
                this.castlingRights.bQ = false;
            }
        }
        if (piece.type === PIECE_TYPES.ROOK) {
            if (fromRow === 7 && fromCol === 0) this.castlingRights.wQ = false;
            if (fromRow === 7 && fromCol === 7) this.castlingRights.wK = false;
            if (fromRow === 0 && fromCol === 0) this.castlingRights.bQ = false;
            if (fromRow === 0 && fromCol === 7) this.castlingRights.bK = false;
        }
        // If a rook is captured
        if (captured && captured.type === PIECE_TYPES.ROOK) {
            if (toRow === 7 && toCol === 0) this.castlingRights.wQ = false;
            if (toRow === 7 && toCol === 7) this.castlingRights.wK = false;
            if (toRow === 0 && toCol === 0) this.castlingRights.bQ = false;
            if (toRow === 0 && toCol === 7) this.castlingRights.bK = false;
        }

        // Track captured pieces
        if (moveInfo.captured) {
            this.capturedPieces[piece.color].push(moveInfo.captured);
        }

        // Half-move clock
        if (piece.type === PIECE_TYPES.PAWN || moveInfo.captured) {
            this.halfMoveClock = 0;
        } else {
            this.halfMoveClock++;
        }

        // Generate notation
        moveInfo.notation = this._generateNotation(moveInfo, toRow, toCol);

        // Switch turn
        if (this.turn === COLORS.BLACK) {
            this.fullMoveNumber++;
        }
        this.turn = this.turn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;

        // Save to history
        this.moveHistory.push(moveInfo);

        // Check game end conditions
        this._checkGameEndConditions();

        // Annotate notation with check/checkmate
        if (this.gameOver && this.gameResult !== 'draw') {
            moveInfo.notation += '#';
        } else if (this._isKingInCheck(this.board, this.turn)) {
            moveInfo.notation += '+';
        }

        return moveInfo;
    }

    _generateNotation(moveInfo, toRow, toCol) {
        const piece = moveInfo.piece;
        const toSq = this.squareToAlgebraic(toRow, toCol);

        if (moveInfo.castling === 'K') return 'O-O';
        if (moveInfo.castling === 'Q') return 'O-O-O';

        let notation = '';

        if (piece.type === PIECE_TYPES.PAWN) {
            if (moveInfo.captured) {
                notation = FILES[moveInfo.from.col] + 'x';
            }
            notation += toSq;
            if (moveInfo.promotion) {
                notation += '=' + PIECE_NAMES[moveInfo.promotion][0];
            }
        } else {
            const pieceChar = piece.type.toUpperCase();
            notation = (piece.type === PIECE_TYPES.KNIGHT ? 'N' : pieceChar);
            if (moveInfo.captured) notation += 'x';
            notation += toSq;
        }

        if (moveInfo.enPassant) notation += ' e.p.';

        return notation;
    }

    _checkGameEndConditions() {
        const hasLegalMoves = this._hasAnyLegalMove(this.turn);
        const inCheck = this._isKingInCheck(this.board, this.turn);

        if (!hasLegalMoves) {
            this.gameOver = true;
            if (inCheck) {
                this.gameResult = this.turn === COLORS.WHITE ? 'black' : 'white';
                this.gameResultReason = 'Checkmate';
            } else {
                this.gameResult = 'draw';
                this.gameResultReason = 'Stalemate';
            }
            return;
        }

        // 50-move rule
        if (this.halfMoveClock >= 100) {
            this.gameOver = true;
            this.gameResult = 'draw';
            this.gameResultReason = '50-move rule';
            return;
        }

        // Insufficient material
        if (this._isInsufficientMaterial()) {
            this.gameOver = true;
            this.gameResult = 'draw';
            this.gameResultReason = 'Insufficient material';
        }
    }

    _hasAnyLegalMove(color) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.color === color) {
                    for (let tr = 0; tr < 8; tr++) {
                        for (let tc = 0; tc < 8; tc++) {
                            const val = this.validateMove(r, c, tr, tc);
                            if (val.valid) return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    isInCheck(color) {
        return this._isKingInCheck(this.board, color);
    }

    _isKingInCheck(board, color) {
        // Find king
        let kingRow = -1, kingCol = -1;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = board[r][c];
                if (p && p.type === PIECE_TYPES.KING && p.color === color) {
                    kingRow = r;
                    kingCol = c;
                    break;
                }
            }
            if (kingRow !== -1) break;
        }
        if (kingRow === -1) return false;

        const opponent = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
        return this._isSquareAttacked(board, kingRow, kingCol, opponent);
    }

    _isSquareAttacked(board, row, col, byColor) {
        // Check all opponent pieces
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board[r][c];
                if (!piece || piece.color !== byColor) continue;
                if (this._canPieceAttack(board, piece, r, c, row, col)) {
                    return true;
                }
            }
        }
        return false;
    }

    _canPieceAttack(board, piece, fromRow, fromCol, toRow, toCol) {
        const dr = toRow - fromRow;
        const dc = toCol - fromCol;
        const absDr = Math.abs(dr);
        const absDc = Math.abs(dc);

        switch (piece.type) {
            case PIECE_TYPES.PAWN: {
                const dir = piece.color === COLORS.WHITE ? -1 : 1;
                return dr === dir && absDc === 1;
            }
            case PIECE_TYPES.KNIGHT:
                return (absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2);
            case PIECE_TYPES.BISHOP:
                return absDr === absDc && absDr > 0 && !this._isPathBlockedOnBoard(board, fromRow, fromCol, toRow, toCol);
            case PIECE_TYPES.ROOK:
                return (dr === 0 || dc === 0) && (absDr + absDc > 0) && !this._isPathBlockedOnBoard(board, fromRow, fromCol, toRow, toCol);
            case PIECE_TYPES.QUEEN:
                return ((absDr === absDc) || (dr === 0 || dc === 0)) && (absDr + absDc > 0) && !this._isPathBlockedOnBoard(board, fromRow, fromCol, toRow, toCol);
            case PIECE_TYPES.KING:
                return absDr <= 1 && absDc <= 1 && (absDr + absDc > 0);
        }
        return false;
    }

    _isPathBlockedOnBoard(board, fromRow, fromCol, toRow, toCol) {
        const dr = Math.sign(toRow - fromRow);
        const dc = Math.sign(toCol - fromCol);
        let r = fromRow + dr;
        let c = fromCol + dc;
        while (r !== toRow || c !== toCol) {
            if (board[r][c]) return true;
            r += dr;
            c += dc;
        }
        return false;
    }

    _cloneBoard() {
        return this.board.map(row => row.map(cell => cell ? { ...cell } : null));
    }

    _applyMoveToBoard(board, fromRow, fromCol, toRow, toCol, promotionPiece = null) {
        const piece = board[fromRow][fromCol];
        if (!piece) return;

        // En passant
        if (piece.type === PIECE_TYPES.PAWN && this.enPassantSquare &&
            toRow === this.enPassantSquare.row && toCol === this.enPassantSquare.col) {
            const capturedRow = piece.color === COLORS.WHITE ? toRow + 1 : toRow - 1;
            board[capturedRow][toCol] = null;
        }

        // Castling rook movement
        if (piece.type === PIECE_TYPES.KING && Math.abs(toCol - fromCol) === 2) {
            const side = toCol > fromCol ? 'K' : 'Q';
            const rookFromCol = side === 'K' ? 7 : 0;
            const rookToCol = side === 'K' ? 5 : 3;
            board[fromRow][rookToCol] = board[fromRow][rookFromCol];
            board[fromRow][rookFromCol] = null;
        }

        board[toRow][toCol] = piece;
        board[fromRow][fromCol] = null;

        // Promotion
        if (piece.type === PIECE_TYPES.PAWN && (toRow === 0 || toRow === 7) && promotionPiece) {
            board[toRow][toCol] = { type: promotionPiece, color: piece.color };
        }
    }

    _isInsufficientMaterial() {
        const pieces = { w: [], b: [] };
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (p) pieces[p.color].push(p);
            }
        }

        // King vs King
        if (pieces.w.length === 1 && pieces.b.length === 1) return true;

        // King + minor piece vs King
        if (pieces.w.length === 1 && pieces.b.length === 2) {
            const other = pieces.b.find(p => p.type !== PIECE_TYPES.KING);
            if (other && (other.type === PIECE_TYPES.BISHOP || other.type === PIECE_TYPES.KNIGHT)) return true;
        }
        if (pieces.b.length === 1 && pieces.w.length === 2) {
            const other = pieces.w.find(p => p.type !== PIECE_TYPES.KING);
            if (other && (other.type === PIECE_TYPES.BISHOP || other.type === PIECE_TYPES.KNIGHT)) return true;
        }

        return false;
    }

    /**
     * Track an illegal move attempt for the end-game summary
     */
    recordIllegalAttempt(fromRow, fromCol, toRow, toCol, reason) {
        const piece = this.getPiece(fromRow, fromCol);
        this.illegalMoveAttempts.push({
            moveNumber: this.fullMoveNumber,
            piece: piece ? { ...piece } : null,
            from: this.squareToAlgebraic(fromRow, fromCol),
            to: this.squareToAlgebraic(toRow, toCol),
            reason: reason,
            pieceName: piece ? PIECE_NAMES[piece.type] : 'Unknown'
        });
    }

    /**
     * Check if a pawn needs promotion
     */
    needsPromotion(fromRow, fromCol, toRow) {
        const piece = this.getPiece(fromRow, fromCol);
        if (!piece || piece.type !== PIECE_TYPES.PAWN) return false;
        return (piece.color === COLORS.WHITE && toRow === 0) || (piece.color === COLORS.BLACK && toRow === 7);
    }

    /**
     * Get all pieces for the AI evaluation
     */
    getAllPieces(color) {
        const pieces = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (p && p.color === color) {
                    pieces.push({ piece: p, row: r, col: c });
                }
            }
        }
        return pieces;
    }
}
