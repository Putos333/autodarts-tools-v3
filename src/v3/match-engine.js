(() => {
  'use strict';
  const core = globalThis.AutodartsToolsV3;
  const ws = globalThis.AutodartsToolsV3WebSocket;
  if (!core || !ws || globalThis.AutodartsToolsV3Match) return;

  const EVT = Object.freeze({ READY:'match:engine-ready', VISIT_START:'match:visit-start', DART:'match:dart', VISIT_COMPLETE:'match:visit-complete', BUST:'match:bust', CHECKOUT:'match:checkout', GAME_SHOT:'match:game-shot', MATCH_SHOT:'match:match-shot' });
  const state = { matchId:null, visits:0, darts:0, busts:0, checkouts:0, lastPlayerIndex:null, lastVisitKey:null };
  const unsubs = [];
  const emit = (type,payload) => core.emit(type,Object.freeze(payload));

  function scoreFor(match, playerIndex) { const scores=match?.gameScores; return Array.isArray(scores)&&Number.isFinite(scores[playerIndex])?scores[playerIndex]:null; }
  function playerFor(match, playerIndex) { const p=Array.isArray(match?.players)?match.players[playerIndex]:null; return p?{index:playerIndex,id:p.id??p.userId??null,name:p.name??p.displayName??null}:{index:playerIndex,id:null,name:null}; }
  function visitContext(payload) {
    const match=payload?.match, playerIndex=Number.isFinite(match?.player)?match.player:null, turn=Array.isArray(match?.turns)?match.turns[0]:null;
    return { matchId:match?.id??null, player:playerFor(match,playerIndex), round:Number.isFinite(match?.round)?match.round:null, remaining:scoreFor(match,playerIndex), visitScore:Number.isFinite(turn?.points)?turn.points:null, throwCount:Array.isArray(turn?.throws)?turn.throws.length:0, busted:Boolean(turn?.busted), match };
  }
  function onMatchUpdate(payload) {
    const ctx=visitContext(payload); if(!ctx.matchId)return;
    if(state.matchId!==ctx.matchId){state.matchId=ctx.matchId;state.lastVisitKey=null;state.lastPlayerIndex=null;emit(EVT.READY,ctx);}
    const visitKey=`${ctx.matchId}:${ctx.player.index}:${ctx.round}:${ctx.throwCount===0?'start':'active'}`;
    if(ctx.throwCount===0&&visitKey!==state.lastVisitKey){state.visits++;emit(EVT.VISIT_START,ctx);}
    state.lastVisitKey=visitKey;state.lastPlayerIndex=ctx.player.index;
  }
  function onDart(dart) { state.darts++; const matchState=ws.getMatch?.(dart.matchId)??null, playerIndex=Number.isFinite(dart.playerIndex)?dart.playerIndex:null; emit(EVT.DART,{...dart,player:playerFor(matchState,playerIndex),remaining:scoreFor(matchState,playerIndex),match:matchState}); }
  function onTurn(payload){const ctx=visitContext(payload);if(ctx.throwCount>=3&&!ctx.busted)emit(EVT.VISIT_COMPLETE,ctx);}
  function onBust(payload){state.busts++;emit(EVT.BUST,visitContext(payload));}
  function onGameShot(payload){state.checkouts++;const ctx=visitContext(payload),winnerIndex=payload?.winnerIndex??null;emit(EVT.CHECKOUT,{...ctx,winner:playerFor(payload?.match,winnerIndex)});emit(EVT.GAME_SHOT,{...ctx,winner:playerFor(payload?.match,winnerIndex)});}
  function onMatchShot(payload){const ctx=visitContext(payload),winnerIndex=payload?.winnerIndex??null;emit(EVT.MATCH_SHOT,{...ctx,winner:playerFor(payload?.match,winnerIndex)});}

  const api=Object.freeze({events:EVT,snapshot:()=>({...state})});
  Object.defineProperty(globalThis,'AutodartsToolsV3Match',{value:api,enumerable:false});
  core.registerModule({id:'match.engine',start(){unsubs.push(core.on(ws.events.MATCH_UPDATE,onMatchUpdate));unsubs.push(core.on(ws.events.DART_THROW,onDart));unsubs.push(core.on(ws.events.TURN_UPDATE,onTurn));unsubs.push(core.on(ws.events.BUST,onBust));unsubs.push(core.on(ws.events.GAME_SHOT,onGameShot));unsubs.push(core.on(ws.events.MATCH_SHOT,onMatchShot));},stop(){while(unsubs.length)unsubs.pop()();}});
  core.startModule('match.engine');
})();
