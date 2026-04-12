/**
 * App Controller — Connects ChessEngine, ChessAI, and the UI.
 * Handles user interactions, board rendering, and move flow.
 */

class ChessApp {
    constructor() {
        this.engine = new ChessEngine();
        this.ai = new ChessAI(this.engine);
        this.boardFlipped = false;

        // Confirm dialog state
        this._pendingAction = null; // 'resign' or 'draw'

        // Selection state
        this.selectedSquare = null; // {row, col}
        this.legalMoves = [];

        // Promotion state
        this.pendingPromotion = null; // {fromRow, fromCol, toRow, toCol}

        // DOM references
        this.boardEl = document.getElementById('chessboard');
        this.statusEl = document.getElementById('game-status');
        this.moveListEl = document.getElementById('move-list');
        this.feedbackListEl = document.getElementById('feedback-list');
        this.mistakeBadgeEl = document.getElementById('mistake-badge');
        this.toastEl = document.getElementById('mistake-toast');
        this.toastMessageEl = document.getElementById('toast-message');
        this.gameOverOverlay = document.getElementById('game-over-overlay');

        // Captured pieces display
        this.whiteCapturesEl = document.getElementById('white-captures');
        this.blackCapturesEl = document.getElementById('black-captures');

        // Turn indicators
        this.playerTurnEl = document.getElementById('player-turn-indicator');
        this.aiTurnEl = document.getElementById('ai-turn-indicator');

        this._bindEvents();
        this._renderBoard();
        this._renderLabels();
        this._updateStatus();
    }

    _bindEvents() {
        // Board clicks
        this.boardEl.addEventListener('click', (e) => this._handleSquareClick(e));

        // Buttons
        document.getElementById('btn-new-game').addEventListener('click', () => this._newGame());
        document.getElementById('btn-flip-board').addEventListener('click', () => this._flipBoard());
        document.getElementById('btn-play-again').addEventListener('click', () => this._newGame());
        document.getElementById('toast-close').addEventListener('click', () => this._hideToast());

        // Resign & Draw
        document.getElementById('btn-resign').addEventListener('click', () => this._confirmResign());
        document.getElementById('btn-draw').addEventListener('click', () => this._confirmDraw());
        document.getElementById('btn-confirm-cancel').addEventListener('click', () => this._hideConfirm());
        document.getElementById('btn-confirm-yes').addEventListener('click', () => this._executeConfirmedAction());

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this._switchTab(btn.dataset.tab));
        });

        // Keyboard support
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this._clearSelection();
                this._hideToast();
            }
        });
    }

    // ===== Board Rendering =====

    _renderBoard() {
        this.boardEl.innerHTML = '';

        for (let displayRow = 0; displayRow < 8; displayRow++) {
            for (let displayCol = 0; displayCol < 8; displayCol++) {
                const row = this.boardFlipped ? 7 - displayRow : displayRow;
                const col = this.boardFlipped ? 7 - displayCol : displayCol;

                const square = document.createElement('div');
                square.className = 'square';
                square.classList.add((row + col) % 2 === 0 ? 'light' : 'dark');
                square.dataset.row = row;
                square.dataset.col = col;
                square.id = `square-${row}-${col}`;

                // Last move highlighting
                if (this.engine.moveHistory.length > 0) {
                    const lastMove = this.engine.moveHistory[this.engine.moveHistory.length - 1];
                    if ((row === lastMove.from.row && col === lastMove.from.col) ||
                        (row === lastMove.to.row && col === lastMove.to.col)) {
                        square.classList.add('last-move');
                    }
                }

                // Check highlight
                const piece = this.engine.getPiece(row, col);
                if (piece && piece.type === PIECE_TYPES.KING &&
                    this.engine.isInCheck(piece.color) &&
                    piece.color === this.engine.turn) {
                    square.classList.add('in-check');
                }

                // Selected highlight
                if (this.selectedSquare && this.selectedSquare.row === row && this.selectedSquare.col === col) {
                    square.classList.add('selected');
                }

                // Legal move dots
                const isLegalTarget = this.legalMoves.find(m => m.row === row && m.col === col);
                if (isLegalTarget) {
                    square.classList.add(isLegalTarget.isCapture ? 'legal-capture' : 'legal-move');
                }

                // Render piece
                if (piece) {
                    const pieceEl = document.createElement('span');
                    pieceEl.className = `piece ${piece.color === COLORS.WHITE ? 'white-piece' : 'black-piece'}`;
                    pieceEl.textContent = this.engine.getPieceSymbol(piece);
                    pieceEl.draggable = true;
                    pieceEl.dataset.row = row;
                    pieceEl.dataset.col = col;
                    square.appendChild(pieceEl);
                }

                this.boardEl.appendChild(square);
            }
        }

        // Setup drag/drop
        this._setupDragDrop();
    }

    _renderLabels() {
        const rankLabels = document.getElementById('rank-labels');
        const fileLabels = document.getElementById('file-labels');
        rankLabels.innerHTML = '';
        fileLabels.innerHTML = '';

        for (let i = 0; i < 8; i++) {
            const rank = document.createElement('span');
            rank.textContent = this.boardFlipped ? (i + 1) : (8 - i);
            rankLabels.appendChild(rank);

            const file = document.createElement('span');
            file.textContent = this.boardFlipped ? FILES[7 - i] : FILES[i];
            fileLabels.appendChild(file);
        }
    }

    _setupDragDrop() {
        const pieces = this.boardEl.querySelectorAll('.piece');
        const squares = this.boardEl.querySelectorAll('.square');

        pieces.forEach(pieceEl => {
            pieceEl.addEventListener('dragstart', (e) => {
                const row = parseInt(e.target.dataset.row);
                const col = parseInt(e.target.dataset.col);
                const piece = this.engine.getPiece(row, col);

                if (!piece || piece.color !== this.engine.turn || this.engine.turn !== COLORS.WHITE || this.engine.gameOver) {
                    e.preventDefault();
                    return;
                }

                e.target.classList.add('dragging');
                e.dataTransfer.setData('text/plain', `${row},${col}`);
                e.dataTransfer.effectAllowed = 'move';

                // Show legal moves
                this.selectedSquare = { row, col };
                this.legalMoves = this.engine.getLegalMoves(row, col);
                this._renderBoard();

                // Re-add dragging class since board was re-rendered
                const newPiece = this.boardEl.querySelector(`[data-row="${row}"][data-col="${col}"].piece`);
                if (newPiece) newPiece.classList.add('dragging');
            });

            pieceEl.addEventListener('dragend', (e) => {
                e.target.classList.remove('dragging');
            });
        });

        squares.forEach(sq => {
            sq.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });

            sq.addEventListener('drop', (e) => {
                e.preventDefault();
                const data = e.dataTransfer.getData('text/plain');
                const [fromRow, fromCol] = data.split(',').map(Number);
                const toRow = parseInt(sq.dataset.row);
                const toCol = parseInt(sq.dataset.col);
                this._attemptMove(fromRow, fromCol, toRow, toCol);
            });
        });
    }

    // ===== Move Handling =====

    _handleSquareClick(e) {
        if (this.engine.gameOver || this.engine.turn !== COLORS.WHITE) return;

        const squareEl = e.target.closest('.square');
        if (!squareEl) return;

        const row = parseInt(squareEl.dataset.row);
        const col = parseInt(squareEl.dataset.col);

        if (this.selectedSquare) {
            // If clicking same square, deselect
            if (this.selectedSquare.row === row && this.selectedSquare.col === col) {
                this._clearSelection();
                return;
            }

            // Check if clicking another own piece
            const clickedPiece = this.engine.getPiece(row, col);
            if (clickedPiece && clickedPiece.color === COLORS.WHITE) {
                // Select this piece instead
                this.selectedSquare = { row, col };
                this.legalMoves = this.engine.getLegalMoves(row, col);
                this._renderBoard();
                return;
            }

            // Attempt move
            this._attemptMove(this.selectedSquare.row, this.selectedSquare.col, row, col);
        } else {
            // Select piece
            const piece = this.engine.getPiece(row, col);
            if (piece && piece.color === COLORS.WHITE) {
                this.selectedSquare = { row, col };
                this.legalMoves = this.engine.getLegalMoves(row, col);
                this._renderBoard();
            }
        }
    }

    _attemptMove(fromRow, fromCol, toRow, toCol) {
        // Check for promotion
        if (this.engine.needsPromotion(fromRow, fromCol, toRow)) {
            const validation = this.engine.validateMove(fromRow, fromCol, toRow, toCol);
            if (validation.valid) {
                this._showPromotion(fromRow, fromCol, toRow, toCol);
                return;
            }
        }

        const validation = this.engine.validateMove(fromRow, fromCol, toRow, toCol);

        if (validation.valid) {
            this._executeMove(fromRow, fromCol, toRow, toCol);
        } else {
            this._handleIllegalMove(fromRow, fromCol, toRow, toCol, validation.reason);
        }
    }

    _executeMove(fromRow, fromCol, toRow, toCol, promotionPiece = null) {
        const moveInfo = this.engine.makeMove(fromRow, fromCol, toRow, toCol, promotionPiece);
        this._clearSelection();
        this._renderBoard();
        this._updateMoveList();
        this._updateCapturedPieces();
        this._updateStatus();
        this._updateTurnIndicators();

        if (this.engine.gameOver) {
            this._showGameOver();
            return;
        }

        // AI's turn
        setTimeout(() => this._aiMove(), 500);
    }

    _aiMove() {
        this._updateStatus('thinking');

        setTimeout(() => {
            const move = this.ai.getBestMove();
            if (move) {
                this.engine.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol, move.promotion);
                this._renderBoard();
                this._updateMoveList();
                this._updateCapturedPieces();
                this._updateStatus();
                this._updateTurnIndicators();

                if (this.engine.gameOver) {
                    this._showGameOver();
                }
            }
        }, 300);
    }

    _handleIllegalMove(fromRow, fromCol, toRow, toCol, reason) {
        // Record the mistake
        this.engine.recordIllegalAttempt(fromRow, fromCol, toRow, toCol, reason);

        // Flash the squares
        const fromSqEl = document.getElementById(`square-${fromRow}-${fromCol}`);
        const toSqEl = document.getElementById(`square-${toRow}-${toCol}`);
        if (fromSqEl) {
            fromSqEl.classList.add('illegal-flash');
            setTimeout(() => fromSqEl.classList.remove('illegal-flash'), 600);
        }
        if (toSqEl) {
            toSqEl.classList.add('illegal-flash');
            setTimeout(() => toSqEl.classList.remove('illegal-flash'), 600);
        }

        // Show toast with explanation
        this._showToast(reason);

        // Add to feedback panel
        this._addFeedback(fromRow, fromCol, toRow, toCol, reason);

        // Clear selection
        this._clearSelection();
        this._renderBoard();
    }

    // ===== Promotion =====

    _showPromotion(fromRow, fromCol, toRow, toCol) {
        this.pendingPromotion = { fromRow, fromCol, toRow, toCol };
        const overlay = document.getElementById('promotion-overlay');
        const choices = document.getElementById('promotion-choices');
        choices.innerHTML = '';

        const pieces = [
            { type: PIECE_TYPES.QUEEN, symbol: '♕' },
            { type: PIECE_TYPES.ROOK, symbol: '♖' },
            { type: PIECE_TYPES.BISHOP, symbol: '♗' },
            { type: PIECE_TYPES.KNIGHT, symbol: '♘' }
        ];

        pieces.forEach(p => {
            const btn = document.createElement('button');
            btn.className = 'promotion-choice';
            btn.textContent = p.symbol;
            btn.title = PIECE_NAMES[p.type];
            btn.addEventListener('click', () => {
                overlay.classList.add('hidden');
                this._executeMove(fromRow, fromCol, toRow, toCol, p.type);
                this.pendingPromotion = null;
            });
            choices.appendChild(btn);
        });

        overlay.classList.remove('hidden');
    }

    // ===== UI Updates =====

    _clearSelection() {
        this.selectedSquare = null;
        this.legalMoves = [];
    }

    _updateStatus(mode = null) {
        if (this.engine.gameOver) {
            let text = '';
            if (this.engine.gameResult === 'white') {
                text = `🎉 You win! ${this.engine.gameResultReason}`;
            } else if (this.engine.gameResult === 'black') {
                text = `AI wins! ${this.engine.gameResultReason}`;
            } else {
                text = `Draw — ${this.engine.gameResultReason}`;
            }
            this.statusEl.textContent = text;
            this.statusEl.className = 'status-text';
            return;
        }

        if (mode === 'thinking') {
            this.statusEl.textContent = 'AI is thinking...';
            this.statusEl.className = 'status-text thinking ai-thinking';
            return;
        }

        const inCheck = this.engine.isInCheck(this.engine.turn);
        if (this.engine.turn === COLORS.WHITE) {
            this.statusEl.textContent = inCheck ? 'Your King is in check!' : 'Your turn — White to move';
            this.statusEl.className = inCheck ? 'status-text check' : 'status-text';
        } else {
            this.statusEl.textContent = 'AI is moving...';
            this.statusEl.className = 'status-text thinking';
        }
    }

    _updateTurnIndicators() {
        if (this.engine.turn === COLORS.WHITE && !this.engine.gameOver) {
            this.playerTurnEl.classList.add('active');
            this.aiTurnEl.classList.remove('active');
        } else if (this.engine.turn === COLORS.BLACK && !this.engine.gameOver) {
            this.playerTurnEl.classList.remove('active');
            this.aiTurnEl.classList.add('active');
        } else {
            this.playerTurnEl.classList.remove('active');
            this.aiTurnEl.classList.remove('active');
        }
    }

    _updateMoveList() {
        const history = this.engine.moveHistory;
        if (history.length === 0) {
            this.moveListEl.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">♟</div>
                    <p>No moves yet. Make your first move!</p>
                </div>
            `;
            return;
        }

        let html = '';
        for (let i = 0; i < history.length; i += 2) {
            const moveNum = Math.floor(i / 2) + 1;
            const whiteMove = history[i];
            const blackMove = history[i + 1];

            html += `<div class="move-row">
                <span class="move-number">${moveNum}.</span>
                <span class="move-notation white-move">${whiteMove.notation}</span>
                ${blackMove ? `<span class="move-notation black-move">${blackMove.notation}</span>` : ''}
            </div>`;
        }

        this.moveListEl.innerHTML = html;
        this.moveListEl.scrollTop = this.moveListEl.scrollHeight;
    }

    _updateCapturedPieces() {
        // White captures = pieces white has captured (from black)
        this.whiteCapturesEl.innerHTML = this.engine.capturedPieces.w
            .map(p => `<span class="captured-piece">${PIECE_SYMBOLS[p.color + p.type]}</span>`)
            .join('');

        this.blackCapturesEl.innerHTML = this.engine.capturedPieces.b
            .map(p => `<span class="captured-piece">${PIECE_SYMBOLS[p.color + p.type]}</span>`)
            .join('');
    }

    // ===== Feedback / Toast =====

    _showToast(message) {
        this.toastMessageEl.textContent = message;
        this.toastEl.classList.remove('hidden');

        // Auto-hide after 5 seconds
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => this._hideToast(), 5000);
    }

    _hideToast() {
        this.toastEl.classList.add('hidden');
        clearTimeout(this._toastTimer);
    }

    _addFeedback(fromRow, fromCol, toRow, toCol, reason) {
        const piece = this.engine.getPiece(fromRow, fromCol);
        const pieceName = piece ? PIECE_NAMES[piece.type] : 'Piece';
        const from = this.engine.squareToAlgebraic(fromRow, fromCol);
        const to = this.engine.squareToAlgebraic(toRow, toCol);

        // Remove empty state
        const emptyState = this.feedbackListEl.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        const item = document.createElement('div');
        item.className = 'feedback-item';
        item.innerHTML = `
            <div class="feedback-move">${pieceName} ${from} → ${to}</div>
            <div class="feedback-explanation">${reason}</div>
        `;
        this.feedbackListEl.prepend(item);

        // Update badge
        const count = this.engine.illegalMoveAttempts.length;
        this.mistakeBadgeEl.style.display = count > 0 ? 'inline-flex' : 'none';
        this.mistakeBadgeEl.textContent = count;
    }

    // ===== Tab Switching =====

    _switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-content-${tabName}`);
        });
    }

    // ===== Game Over =====

    _showGameOver() {
        const modal = document.getElementById('game-over-modal');
        const icon = document.getElementById('modal-result-icon');
        const title = document.getElementById('modal-result-title');
        const subtitle = document.getElementById('modal-result-subtitle');

        if (this.engine.gameResult === 'white') {
            icon.textContent = '🏆';
            title.textContent = 'You Win!';
            subtitle.textContent = this.engine.gameResultReason;
        } else if (this.engine.gameResult === 'black') {
            icon.textContent = '💀';
            title.textContent = 'AI Wins';
            subtitle.textContent = this.engine.gameResultReason;
        } else {
            icon.textContent = '🤝';
            title.textContent = 'Draw';
            subtitle.textContent = this.engine.gameResultReason;
        }

        // Stats
        const totalMoves = this.engine.moveHistory.filter(m => m.piece.color === COLORS.WHITE).length;
        document.getElementById('stat-total-moves').textContent = totalMoves;
        document.getElementById('stat-mistakes').textContent = this.engine.illegalMoveAttempts.length;
        document.getElementById('stat-captures').textContent = this.engine.capturedPieces.w.length;

        // Mistake summary
        const mistakes = this.engine.illegalMoveAttempts;
        const summarySection = document.getElementById('mistake-summary-section');
        const summaryList = document.getElementById('mistake-summary-list');

        if (mistakes.length > 0) {
            summarySection.style.display = 'block';
            summaryList.innerHTML = mistakes.map((m, i) => `
                <div class="mistake-summary-item">
                    <div class="ms-move">#${i + 1}: ${m.pieceName} ${m.from} → ${m.to}</div>
                    <div class="ms-reason">${m.reason}</div>
                </div>
            `).join('');
        } else {
            summarySection.style.display = 'none';
        }

        this.gameOverOverlay.classList.remove('hidden');
        this._updateGameButtons();
    }

    // ===== Game Controls =====

    _newGame() {
        this.engine.reset();
        this.ai = new ChessAI(this.engine);
        this._clearSelection();
        this._renderBoard();
        this._updateMoveList();
        this._updateCapturedPieces();
        this._updateStatus();
        this._updateTurnIndicators();
        this._updateGameButtons();
        this._hideToast();
        this._hideConfirm();
        this.gameOverOverlay.classList.add('hidden');

        // Reset feedback
        this.feedbackListEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">✓</div>
                <p>No mistakes yet. Keep it up!</p>
            </div>
        `;
        this.mistakeBadgeEl.style.display = 'none';

        // Reset to moves tab
        this._switchTab('moves');
    }

    _flipBoard() {
        this.boardFlipped = !this.boardFlipped;
        this._renderBoard();
        this._renderLabels();
    }

    // ===== Resign & Draw =====

    _confirmResign() {
        if (this.engine.gameOver) return;
        this._pendingAction = 'resign';
        document.getElementById('confirm-icon').textContent = '⚑';
        document.getElementById('confirm-title').textContent = 'Resign?';
        document.getElementById('confirm-subtitle').textContent = 'Are you sure you want to resign? The AI will win this game.';
        document.getElementById('btn-confirm-yes').className = 'btn btn-danger btn-lg';
        document.getElementById('btn-confirm-yes').innerHTML = '<span class="btn-icon">✓</span> Resign';
        document.getElementById('confirm-overlay').classList.remove('hidden');
    }

    _confirmDraw() {
        if (this.engine.gameOver) return;
        this._pendingAction = 'draw';
        document.getElementById('confirm-icon').textContent = '½';
        document.getElementById('confirm-title').textContent = 'Offer Draw?';
        document.getElementById('confirm-subtitle').textContent = 'Are you sure you want to end the game as a draw?';
        document.getElementById('btn-confirm-yes').className = 'btn btn-primary btn-lg';
        document.getElementById('btn-confirm-yes').innerHTML = '<span class="btn-icon">✓</span> Confirm Draw';
        document.getElementById('confirm-overlay').classList.remove('hidden');
    }

    _executeConfirmedAction() {
        this._hideConfirm();
        if (this._pendingAction === 'resign') {
            this.engine.gameOver = true;
            this.engine.gameResult = 'black';
            this.engine.gameResultReason = 'Resignation';
            this._updateStatus();
            this._updateTurnIndicators();
            this._updateGameButtons();
            this._showGameOver();
        } else if (this._pendingAction === 'draw') {
            this.engine.gameOver = true;
            this.engine.gameResult = 'draw';
            this.engine.gameResultReason = 'Draw by agreement';
            this._updateStatus();
            this._updateTurnIndicators();
            this._updateGameButtons();
            this._showGameOver();
        }
        this._pendingAction = null;
    }

    _hideConfirm() {
        document.getElementById('confirm-overlay').classList.add('hidden');
        this._pendingAction = null;
    }

    _updateGameButtons() {
        const isOver = this.engine.gameOver;
        document.getElementById('btn-resign').disabled = isOver;
        document.getElementById('btn-draw').disabled = isOver;
    }
}

// ===== Initialize App =====
document.addEventListener('DOMContentLoaded', () => {
    window.chessApp = new ChessApp();
});
