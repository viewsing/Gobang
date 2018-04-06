//事件系统
const EventTarget = {
    addEventListener: function(type, callback){
        if (!this.listeners) this.listeners = {};
        if (!(type in this.listeners)) {
            this.listeners[type] = [];
        }
        this.listeners[type].push(callback);
    },
    removeEventListener: function (type, callback) {
        if (!(type in this.listeners)) {
            return;
        }
        var stack = this.listeners[type];
        for (var i = 0, l = stack.length; i < l; i++) {
            if (stack[i] === callback) {
                stack.splice(i, 1);
                return this.removeEventListener(type, callback);
            }
        }
    },
    dispatchEvent: function (event) {
        if (!(event.type in this.listeners)) {
            return;
        }
        var stack = this.listeners[event.type];
        event.target = this;
        for (var i = 0, l = stack.length; i < l; i++) {
            stack[i].call(this, event);
        }
    }
}
//对话框
const Dialog = {
    alert: function(opts){
        const title = opts.title || '提示'; //标题
        const content = opts.content || ''; //内容
        const btnText = opts.btnText || 'ok'; //按钮文字内容
        const template = `<div class="dialog">
            <div class="dialog-content">
                <div class="dialog-header">
                    <span class="dialog-title">${title}<span>
                    <span class="dialog-closeBtn">×</span>
                </div>
                <div class="dialog-body">
                    <p>${content}</p>
                </div>
                <div class="dialog-footer">
                    <button class="dialog-okBtn">${btnText}</button>
                </div>
            </div>
            <div class="dialog-backdrop"></div>
        </div>`;
        const range = document.createRange();
        const parse = range.createContextualFragment.bind(range);
        const dialog = parse(template)
        const handler = document.createElement('div');
        handler.appendChild(dialog);
        //关闭按钮
        handler.getElementsByClassName('dialog-closeBtn')[0].addEventListener('click', function(){
            handler.parentNode.removeChild(handler);
        })
        handler.getElementsByClassName('dialog-okBtn')[0].addEventListener('click', function(){
            handler.parentNode.removeChild(handler);
        })
        document.body.appendChild(handler);
        return handler;
    },
    confirm: function(opts){
        const title = opts.title || '提示'; //标题
        const content = opts.content || ''; //内容
        const notClose = opts.notClose || false; //是否允许关闭
        const footerClass = opts.footerClass || ''; //底部样式
        const btnText = opts.btn && opts.btn.text || 'ok'; //按钮文字内容
        const btnCallback = opts.btn && opts.btn.callback || function(){}; //点击按钮回调事件
        const template = `<div class="dialog">
            <div class="dialog-content">
                <div class="dialog-header">
                    <span class="dialog-title">${title}<span>
                    ${ notClose ? '' : '<span class="dialog-closeBtn">×</span>'}
                </div>
                <div class="dialog-body">
                    <p>${content}</p>
                </div>
                <div class="dialog-footer ${footerClass}">
                    <button class="dialog-cancelBtn">取消</button>
                    <button class="dialog-okBtn">${btnText}</button>
                </div>
            </div>
            <div class="dialog-backdrop"></div>
        </div>`;
        const range = document.createRange();
        const parse = range.createContextualFragment.bind(range);
        const dialog = parse(template)
        const handler = document.createElement('div');
        handler.appendChild(dialog);
        //关闭按钮
        const closeBtn = handler.getElementsByClassName('dialog-closeBtn')[0];
        closeBtn && closeBtn.addEventListener('click', function(){
            handler.parentNode.removeChild(handler);
        })
        //取消按钮
        const cancelBtn = handler.getElementsByClassName('dialog-cancelBtn')[0];
        cancelBtn && cancelBtn.addEventListener('click', function(){
            handler.parentNode.removeChild(handler);
        })
        //确认按钮
        const confirmBtn = handler.getElementsByClassName('dialog-okBtn')[0]
        confirmBtn && confirmBtn.addEventListener('click', function(){
            handler.parentNode.removeChild(handler);
            btnCallback();
        })
        document.body.appendChild(handler);
        return handler;
    }
}

/**
 * 全局变量设置 
 */
//玩家设置
const Players = {
    player1: {
        num: 1,
        name: '黑棋',
        className: 'black',
        color1: '#020202',
        color2: '#686d6c'
    },
    player2: {
        num: 2,
        name: '白棋',
        className: 'white',
        color1: '#d0d0d0',
        color2: '#f5f4f4'
    }
}
//是否游戏结束
let IsEnd;
//当前下棋人
let NowPlayer;
//棋盘格子数
let GridNum;
//全局唯一，存储当前状态快照
let STATE;
//棋局状态栈
let ChessStack;
//撤销状态栈
let UndoStack;
//权重坐标数组
let Weight;
//是否与人工智障对战
let AI;
/**
 * 游戏逻辑部分 
 */
const PLAY = Object.create(EventTarget);
/**
 * 判断输赢函数，类似动态规划的问题。五子棋是当有五个连续的棋子的时候，游戏就结束了。
 * 利用分治思想，我们分解出子问题，当有一个棋子时，当有两个连续棋子时，当有三个连续棋子时....如此类推。
 * 我们先判断第一个子问题，当符合第一个子问题的时候，我们才接着判断是否符合第二个子问题，然后是第三个，如此类推。
 * 连续棋子又有四种情况，垂直线上、水平线上、左上角至右下角、右上角至左下角。依次判断。
 */
PLAY.checkEnding = function (state) {
    const coords = state.coords;
    const playerNum = state.coords[state.lastCoord.x][state.lastCoord.y];
    const player = Players['player'+playerNum];
    let ending = false;
    for (var i = 0; i < coords.length; i++) {
        for (var j = 0; j < coords.length; j++) {
            if (coords[i][j] === playerNum) {
                checkFive(i, j, coords);
            }
            //如果是人机对战，并且轮到AI下了，则计算权重坐标数组
            if (AI && NowPlayer.num === 2){
                this.calcArr(i, j, coords);
            }
        }
    }
    //开门
    PLAY.isOpen = true;
    //如果达到五个棋子则游戏结束
    if (ending) return this.afterEnding(player);
    //如果是人机对战，并且轮到AI下了，则计算最大权重并下棋
    if (AI && NowPlayer.num === 2) {
        this.searchMaxWeight();
        PLAY.dispatchEvent({
            type: 'nextChess',
            data: {
                x: Weight.maxWeight.x,
                y: Weight.maxWeight.y
            }
        })
    }
    //检查是否连续五个函数
    function checkFive(x, y, coords) {
        //最长连续棋子数
        let continuous = 0,
            cursorX = x,    //浮标
            cursorY = y;
        //下标操作数组；从左往右，从上到下，从左上到右下，从右上到左下；
        const funcArr = [
            function(){
                cursorX++;
            },
            function(){
                cursorY++
            },
            function(){
                cursorX++;
                cursorY++;
            },
            function(){
                cursorX--;
                cursorY++;
            }
        ]
        //是否数组越界
        const isOutOfRange = function(){
            return (cursorX >= 0) && (cursorX <= GridNum) && (cursorY >= 0) && (cursorY <= GridNum);
        }
        //四个方向各探索一遍
        for (var i = 0; i < funcArr.length; i++) {
            //计算连续棋子数
            do {
                continuous++;
                funcArr[i]();
            } while ( isOutOfRange() && coords[cursorX][cursorY] === playerNum);
            //当连续相同的棋子达到 5 个时
            if (continuous >= 5) {
                return (ending = true);
            } else {
                continuous = 0;
                cursorX = x;
                cursorY = y;
            }
        }
    }
}
//计算权重坐标数组
PLAY.calcArr = function(x, y, coords) {
    //如果不是0，则该位置已经落棋
    if (coords[x][y] !== 0) {
        return (Weight.weightArr1[x][y] = 0), (Weight.weightArr2[x][y] = 0);
    }
    
    let weight = 0, //权重
        continuous, //某一方向上连续棋子的个数
        cursorX,    //浮标
        cursorY,
        i,
        j,
        playerNum;
    //下标操作数组；从左往右，从上到下，从右到左，从下到上，从左上到右下，从右上到左下，从左下到右上，从右下到左上
    const funcArr = [
        function(){
            cursorX++;
            // perWeight = 2;
        },
        function(){
            cursorY++;   
            // perWeight = 4;  
        },
        function(){
            cursorX--;
            // perWeight = 2;
        },
        function(){
            cursorY--;
            // perWeight = 4;
        },
        function(){
            cursorX++;
            cursorY++;
        },
        function(){
            cursorX--;
            cursorY++;
        },
        function(){
            cursorX++;
            cursorY--;
        },
        function(){
            cursorX--;
            cursorY--;
        }
    ]

    //是否数组越界
    const isOutOfRange = function(){
        return (cursorX >= 0) && (cursorX <= GridNum) && (cursorY >= 0) && (cursorY <= GridNum);
    }

    //分别计算黑棋(1)和白棋(2)的权重坐标数组
    for ( playerNum = 1; playerNum < 3; playerNum++) {
        //8个方向各探索一遍
        for ( j = 0, weight = 0; j < funcArr.length; j++) {
            //每个方向上探索
            for ( i = 0, cursorX = x, cursorY = y, continuous = 1, funcArr[j](); //初始化
                  isOutOfRange(); //判断数组越界
                  i++, funcArr[j]() ) { //执行下标操作

                //如果是连续对应的棋子，则权重加1
                if (coords[cursorX][cursorY] === playerNum) {
                    weight += continuous;
                    continuous *= 10; //连续的棋子越多，权重越大
                    continue;
                //如果中途被另一种颜色的棋子截断了，则结束这个方向上的探索
                } else {
                    break;
                }
            }
        }
        //最终权重
        Weight['weightArr' + playerNum][x][y] = weight;
    } 
}
//计算最大权重
PLAY.searchMaxWeight = function() {
    Weight.maxWeight.value = 0;
    Weight.maxWeight.x = 0;
    Weight.maxWeight.y = 0;
    //遍历二维权重坐标数组
    for (var numX = 0; numX < GridNum; numX++) {

        for (var numY = 0; numY <= GridNum; numY++) {
            //黑棋的权重*5 + 白棋的权重*2 （以堵为主）
            let newWeight = Weight.weightArr1[numX][numY]*5 + Weight.weightArr2[numX][numY]*2 ;
            //如果有更大的权重，则赋值为更大的
            if (newWeight > Weight.maxWeight.value) {
                Weight.maxWeight.value = newWeight;
                Weight.maxWeight.x = numX;
                Weight.maxWeight.y = numY;
            }
        }

    }
}
//游戏结束
PLAY.afterEnding = function(player){
    UI.dispatchEvent({type: 'ending'});
    Dialog.alert({content: player.name + '赢了'});
    IsEnd = true;
}
//防止快速点击
PLAY.isOpen = true;
//下棋逻辑
PLAY.addEventListener('nextChess', function(event){
    //判断是否已结束游戏
    if (IsEnd) {
        if ( confirm('再来一局？') ) {
            Gobang();
        }
        return;
    }
    //点击位置x, y 已映射为坐标数组的下标.
    const x = event.data.x;
    const y = event.data.y;
    if (STATE.coords[x][y] !== 0) return Dialog.alert({content: '同一处不能重复下棋'});
    //检测结果在下面异步执行，防止快速点击
    if (!this.isOpen) return;
    //关门
    this.isOpen = false;
    //将旧状态加入状态栈
    ChessStack.push(STATE);
    //新状态
    const newState = {
        lastCoord: {
            x: x,
            y: y
        },
        coords: STATE.coords.map(function(arr, coordX){
            return arr.map(function(step, coordY){
                if (coordX === x && coordY === y) {
                    return NowPlayer.num;
                } else {
                    return step;
                }
            });
        })
    }
    //改变棋局状态
    STATE = newState;
    //切换玩家
    NowPlayer = ( NowPlayer === Players.player1 ? Players.player2 : Players.player1 ); 
    //刷新视图
    UI.dispatchEvent({type:'render'});

    //解决棋子还没落下就提示胜利的问题（图像在浏览器渲染引擎的缓冲区中，还未渲染出来）
    setTimeout(function(){
        //检测游戏结果
        PLAY.checkEnding(STATE);
    }, 50);
})
//悔棋逻辑
PLAY.addEventListener('undo', function(){
    //回退第二个状态就是上一回合的
    const state1 = ChessStack.pop();
    const state2 = ChessStack.pop();
    if (!state2) return;
    //将状态加入撤销栈
    UndoStack.push(STATE);
    UndoStack.push(state1);

    //改变当前状态
    STATE = state2;
    UI.dispatchEvent({type: 'render'});
})
//撤销悔棋逻辑
PLAY.addEventListener('beforeUndo', function(){
    //回退第二个状态就是上一回合的
    const state1 = UndoStack.pop();
    const state2 = UndoStack.pop();
    if (!state2) return Dialog.alert({content: '已撤销至最先那步'});
    //将状态加入状态栈
    ChessStack.push(STATE);
    ChessStack.push(state1);
    //改变当前状态
    STATE = state2;
    UI.dispatchEvent({type: 'render'});
})
//重新游戏
PLAY.addEventListener('restart', function(){
    Gobang();
})

/**
 * 五子棋视图部分 
 */
const UI = Object.create(EventTarget);
//初始化
UI.init = function (dom) {
    //游戏根节点
    this.GobangNode = dom;
    //游戏区域
    const areaNode = document.createElement('div');
    areaNode.className = 'playarea';
    dom.appendChild(areaNode);
    this.playCanvas = areaNode.appendChild(document.createElement('canvas'));
    //canvas上下文
    this.canvasContext = this.playCanvas.getContext('2d');
    //游戏看板
    dom.appendChild((this.kanbanNode = this.createKanban()));
    //canvas最大宽度,取正方形;50是上margin + border + 下留白;40是棋盘padding;gridNum + 1是棋盘线
    const maxWidth = (areaNode.offsetWidth < areaNode.offsetHeight ? areaNode.offsetWidth : areaNode.offsetHeight) - 50 - 40 - GridNum - 1;
    //每一个游戏格子的宽度
    this.gridWidth = Math.floor(maxWidth / GridNum);
    //canvas实际宽度(为了使宽度正好等于格子宽度和间隔线之和)
    this.playAreaWidth = this.gridWidth * GridNum + GridNum + 1 + 40;
    this.playCanvas.style.width = this.playAreaWidth + 'px';
    this.playCanvas.setAttribute('width', this.playAreaWidth + 'px');
    this.playCanvas.style.height = this.playAreaWidth + 'px';
    this.playCanvas.setAttribute('height', this.playAreaWidth + 'px');
    //开始渲染
    this.render();
    this.bindEvent();
}
//创建看板
UI.createKanban = function () {
    let kanbanNode = document.createElement('div');
    kanbanNode.className = 'kanban';
    //当前玩家展示
    const displayPlayerNode = document.createElement('p');
    displayPlayerNode.className = 'nowPlayer';
    displayPlayerNode.appendChild(document.createElement('span'));
    kanbanNode.appendChild( (this.displayPlayerNode = displayPlayerNode) );
    //按钮组
    const btns = [{
            text: '重新游戏',
            className: 'restart'
        },
        {
            text: '悔棋',
            className: 'undo'
        },
        {
            text: '撤销悔棋',
            className: 'beforeUndo'
        }
    ];
    for (var i = 0; i < btns.length; i++) {
        let pNode = document.createElement('p');
        let btnNode = document.createElement('button');
        btnNode.type = 'button';
        btnNode.innerText = btns[i].text;
        btnNode.className = btns[i].className;
        pNode.appendChild(btnNode);
        kanbanNode.appendChild(pNode);
    }
    return kanbanNode;
}
//渲染棋局
UI.render = function (event) {
    this.canvasContext.clearRect(0, 0, this.playAreaWidth, this.playAreaWidth);
    this.renderChessBoard();
    this.renderChesses();
    this.renderDisplayPlayer();
}
//渲染棋盘
UI.renderChessBoard = function () {
    const ctx = this.canvasContext;
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    //边框
    const tempCoord = (1 + this.gridWidth) * GridNum;
    this.drawBoardLine(ctx, 1, 1, tempCoord, 1);
    this.drawBoardLine(ctx, tempCoord, 1, tempCoord, tempCoord);
    this.drawBoardLine(ctx, tempCoord, tempCoord, 1, tempCoord);
    this.drawBoardLine(ctx, 1, tempCoord, 1, 1);
    for (let i = 1; i < GridNum; i++) {
        //垂直线
        this.drawBoardLine(ctx, (this.gridWidth + 1) * i, 0, (this.gridWidth + 1) * i, tempCoord);
        //水平线
        this.drawBoardLine(ctx, 0, (this.gridWidth + 1) * i, tempCoord, (this.gridWidth + 1) * i);
    }
}
//画棋盘线
UI.drawBoardLine = function(ctx, x, y, endX, endY) {
    //+0.5是为了修复画1像素宽度的线时不精确问题，+20是为了偏移
    x += 20.5, y += 20.5, endX += 20.5, endY += 20.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.closePath();
}
//渲染全部棋子
UI.renderChesses = function () {
    //标记上一个落棋点
    for (let i = 0; i < STATE.coords.length; i++ ) {
        for (let j = 0; j < STATE.coords.length; j++ ) {
            let latestChess = false;
            if (STATE.coords[i][j] === 0) continue;
            const x = 20 + i * (this.gridWidth + 1);
            const y = 20 + j * (this.gridWidth + 1);
            if (i === STATE.lastCoord.x && j === STATE.lastCoord.y) {
                latestChess = true;
            }
            this.renderChess(x, y, 'player' + STATE.coords[i][j], latestChess); 
        }
    }
}
//渲染单个棋子
UI.renderChess = function (x, y, player, latestChess) {
    const ctx = this.canvasContext;
    //棋子直径为格子的80%；
    const radius = Math.floor(this.gridWidth * 0.8 * 0.5);
    ctx.beginPath();
    //添加渐变效果
    var gradient = ctx.createRadialGradient(x, y, radius, x, y, Math.floor(radius * 0.2));
    gradient.addColorStop(0, Players[player].color1);
    gradient.addColorStop(1, Players[player].color2);
    ctx.fillStyle = gradient;
    ctx.moveTo(x, y);
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.closePath();
    //如果是最后一个棋子，中心点标红
    if (latestChess) {
        ctx.beginPath();
        ctx.fillStyle = '#e45d45';
        ctx.arc(x, y, radius*0.2, 0, 2 * Math.PI);
        ctx.fill();
        ctx.closePath();
    }
}
//渲染当前玩家
UI.renderDisplayPlayer = function () {
    let playerName = NowPlayer.name,
        className = NowPlayer.className;
    const spanNode = this.displayPlayerNode.getElementsByTagName('span')[0];
    spanNode.className = className;
}
//游戏结束
UI.ending = function(){
    const undoNode = this.kanbanNode.getElementsByClassName('undo')[0];
    const beforeUndoNode = this.kanbanNode.getElementsByClassName('beforeUndo')[0];
    undoNode.setAttribute('disabled', 'disabled');
    beforeUndoNode.setAttribute('disabled', 'disabled');
}
//重新游戏
UI.restart = function(){
    const undoNode = this.kanbanNode.getElementsByClassName('undo')[0];
    const beforeUndoNode = this.kanbanNode.getElementsByClassName('beforeUndo')[0];
    undoNode.removeAttribute('disabled');
    beforeUndoNode.removeAttribute('disabled');
    this.dispatchEvent({type: 'render'});
}
//绑定事件
UI.bindEvent = function () {
    //看板的点击事件
    this.kanbanNode.addEventListener('click', function (event) {
        const className = event.target.className;
        const customEvent = {};
        switch (className) {
            case 'restart':
                customEvent.type = 'restart';
            break;
            case 'undo':
                customEvent.type = 'undo';
            break;
            case 'beforeUndo':
                customEvent.type = 'beforeUndo';
            break;
        }
        PLAY.dispatchEvent(customEvent);
    });
    //画布的点击事件
    this.playCanvas.addEventListener('click', this.nextChess.bind(this));
    //渲染视图事件
    this.addEventListener('render', this.render);
    //结束游戏
    this.addEventListener('ending', this.ending);
    //重新开始
    this.addEventListener('restart', this.restart);
}
//下棋
UI.nextChess = function (event) {
    const x = event.offsetX - 20;
    const y = event.offsetY - 20;
    //横向第几个
    const numX = Math.round(x / this.gridWidth);
    //纵向第几个
    const numY = Math.round(y / this.gridWidth);
    // 把数组下标给游戏逻辑部分
    PLAY.dispatchEvent({
        type: 'nextChess',
        data: {
            x: numX,
            y: numY
        }
    })
}

//五子棋
const Gobang = function(GobangNode){
    //游戏结束标志
    IsEnd = false;
    //棋局状态栈
    ChessStack = [];
    //撤销状态栈
    UndoStack = [];
    //黑子先行
    NowPlayer = Players.player1;
    //权重坐标数组
    Weight = {
        maxWeight: {
            value: 0,
            x: 0,
            y: 0
        },
        weightArr1: [],
        weightArr2: []
    }
    if (window.innerWidth < 478) {
        GridNum = 9;
    } else {
        GridNum = 15;
    }
    //初始化坐标映射数组
    STATE = {
        coords: [],
        lastCoord: {}
    };
    for (let i = 0; i < GridNum + 1; i++) {
        let tempArr = [];
        for (let j = 0; j < GridNum + 1; j++) {
            tempArr.push(0);
        }
        STATE.coords.push(tempArr);
    }

    //判断是初始化页面还是初始化游戏?
    if (UI.GobangNode) {
        UI.dispatchEvent({type: 'restart'});
    } else {
        UI.init(GobangNode);
    }

    //选择游戏模式
    const dialogNode = Dialog.confirm({
        title: '选择游戏模式',
        notClose: true,
        content: '<div class="choseMode"><button class="playWithPerson">玩家对战</button><button class="playWithAI">人机对战</button></div>',
        footerClass: 'dialog-footer-custom',
    })
    //玩家对战
    dialogNode.getElementsByClassName('playWithPerson')[0].addEventListener('click', function(){
        AI = false;
        dialogNode.parentNode.removeChild(dialogNode);
    })
    //人机对战
    dialogNode.getElementsByClassName('playWithAI')[0].addEventListener('click', function(){
        AI = true;
        //初始化权重坐标数组
        for (let i = 0; i < GridNum + 1; i++) {
            Weight.weightArr1.push([]), Weight.weightArr2.push([]);
        }
        dialogNode.parentNode.removeChild(dialogNode);
    })
}

window.onload = function () {
    var GobangNode = document.getElementById('Gobang');
    Gobang(GobangNode);
}