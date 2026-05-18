

const PR = 28, TW = 62, TH = 36;




//if its too slow change to 800
const SIM_SPEED = 1100;

let nodes = {}, arcs = [], mode = 'select';

let arcStart = null, selected = null, idCtr = 0;
let modelFileName = null;

function updateTitleBar() {
  const el = document.getElementById('titlebar-name');
  if (el) el.textContent = modelFileName ? modelFileName : 'Untitled';
}


let simTokens = {};
let simRunning = false, simTimer = null;
let activeGlows = {};

function triggerGlow(id, color) {
  if (activeGlows[id]) clearTimeout(activeGlows[id].timer);
  activeGlows[id] = {
    color: color,
    timer: setTimeout(() => {
      delete activeGlows[id];
      renderNodes();
    }, 500)
  };
}

let zoomLevel = 1.0;
let panX = 0, panY = 0;

function applyTransform() {
  document.getElementById('zoom-layer').setAttribute('transform', `translate(${panX},${panY}) scale(${zoomLevel})`);
}
function zoomIn() {
  zoomLevel *= 1.2;
  applyTransform();
}
function zoomOut() {
  zoomLevel /= 1.2;
  applyTransform();
}

let initialTokens = {};

function uid(p) { return p + (++idCtr); }











function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;'); }

function liveTokens(id) {

  return (id in simTokens) ? simTokens[id] : (nodes[id]?.tokens ?? 0);
}



function setMode(m) {
  mode = m; arcStart = null;


  document.getElementById('arc-prev').setAttribute('display','none');


  document.querySelectorAll('.toolbuttons').forEach(b => b.classList.remove('active'));
  
  
  
  const map = {select:'btn-select',place:'btn-place',transition:'btn-trans',arc:'btn-arc',biarc:'btn-biarc'};

  

  if(map[m]) document.getElementById(map[m]).classList.add('active');
  
  document.getElementById('mode-labell').textContent = 'mode: '+m;
}


function validate() {
	//check if place is in dictionary 
	//if not dont add to canvas
	
	}


function svgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);

  for(const [k,v] of Object.entries(attrs)) el.setAttribute(k, v);

  return el;
}

function nodeCenter(n) {


  return n.type === 'place' ? {x:n.x, y:n.y} : {x:n.x+TW/2, y:n.y+TH/2};



}




function arcEndpoints(a, b) {


  const ac=nodeCenter(a), bc=nodeCenter(b);


  const dx=bc.x-ac.x, dy=bc.y-ac.y, d=Math.sqrt(dx*dx+dy*dy)||1;
  let sx,sy,ex,ey;

  if(a.type==='place'){sx=ac.x+dx/d*PR;sy=ac.y+dy/d*PR;}
  else{const t=Math.min((TW/2)/Math.abs(dx||.001),(TH/2)/Math.abs(dy||.001));sx=ac.x+dx*t;sy=ac.y+dy*t;}


  if(b.type==='place'){ex=bc.x-dx/d*(PR+7);ey=bc.y-dy/d*(PR+7);}

  else{const t=Math.min((TW/2+6)/Math.abs(dx||.001),(TH/2+6)/Math.abs(dy||.001));ex=bc.x-dx*t;ey=bc.y-dy*t;}
  return {sx,sy,ex,ey};


}







function getTransitionImpact(tid) {
  const consumed = {};
  const produced = {};
  const requires = {};
  const forbids = {};
  let hasInput = false;

  for(const arc of arcs.filter(a => a.to === tid)) {
    hasInput = true;
    const w = arc.weight ?? 1;
    if (arc.arcType === 'inhibitor') {
      forbids[arc.from] = Math.min(forbids[arc.from] ?? Infinity, w);
    } else if (arc.arcType === 'read') {
      requires[arc.from] = Math.max(requires[arc.from] || 0, w);
    } else if (arc.arcType === 'reset') {
      consumed[arc.from] = 'ALL';
    } else {
      if (consumed[arc.from] !== 'ALL') {
        consumed[arc.from] = (consumed[arc.from] || 0) + w;
      }
      requires[arc.from] = Math.max(requires[arc.from] || 0, consumed[arc.from] === 'ALL' ? w : consumed[arc.from]);
    }
  }
  for(const arc of arcs.filter(a => a.from === tid)) {
    produced[arc.to] = (produced[arc.to] || 0) + (arc.weight ?? 1);
  }
  for(const arc of arcs.filter(a => a.bidir && (a.from===tid||a.to===tid))) {
    const other = arc.from===tid ? arc.to : arc.from;
    if(nodes[other]?.type==='place') {
      produced[other] = (produced[other] || 0) + (arc.weight ?? 1);
    }
  }
  return { consumed, produced, requires, forbids, hasInput };
}

function getEnabledTransitions() {
  const result = [];
  for(const id in nodes) {
    const t = nodes[id];
    if(t.type !== 'transition' || !t.fire) continue;

    const { consumed, produced, requires, forbids, hasInput } = getTransitionImpact(id);

    let ok = true;
    for(const pid in requires) {
      if(liveTokens(pid) < requires[pid]) { ok=false; break; }
    }
    for(const pid in forbids) {
      if(liveTokens(pid) >= forbids[pid]) { ok=false; break; }
    }
    if (ok) {
      const affected = new Set([...Object.keys(consumed), ...Object.keys(produced)]);
      for(const pid of affected) {
        const p = nodes[pid];
        if (p && p.capacity !== undefined && p.capacity !== null) {
          const cAmt = consumed[pid] === 'ALL' ? liveTokens(pid) : (consumed[pid] || 0);
          if (liveTokens(pid) - cAmt + (produced[pid]||0) > p.capacity) {
            ok = false; break;
          }
        }
      }
    }
    if(ok) result.push(id);
  }
  return result;
}

function refreshAutoDisable() {
  for(const id in nodes) {
    const t = nodes[id];
    if(t.type !== 'transition') continue;

    const { consumed, produced, requires, forbids } = getTransitionImpact(id);
    let disabled = false;
    for(const pid in requires) {
      if(liveTokens(pid) < requires[pid]) { disabled=true; break; }
    }
    for(const pid in forbids) {
      if(liveTokens(pid) >= forbids[pid]) { disabled=true; break; }
    }
    if (!disabled) {
      const affected = new Set([...Object.keys(consumed), ...Object.keys(produced)]);
      for(const pid of affected) {
        const p = nodes[pid];
        if (p && p.capacity !== undefined && p.capacity !== null) {
          const cAmt = consumed[pid] === 'ALL' ? liveTokens(pid) : (consumed[pid] || 0);
          if (liveTokens(pid) - cAmt + (produced[pid]||0) > p.capacity) {
            disabled = true; break;
          }
        }
      }
    }
    t._autoDisabled = disabled;
  }
}

function pickFiringSet(enabled) {
  if(enabled.length === 0) return [];
  const sorted = [...enabled].sort((a,b) => (nodes[b].priority||0)-(nodes[a].priority||0));
  const topPrio = nodes[sorted[0]].priority || 0;
  const candidates = sorted.filter(id => (nodes[id].priority||0) === topPrio);
  
  const randomIdx = Math.floor(Math.random() * candidates.length);
  return [candidates[randomIdx]];
}

function message(x) {
	
	//just use as print statment debugger probably idk
	
	}



function fireTransitions(toFire) {
  if(toFire.length === 0) return false;
  for(const tid of toFire) {
    triggerGlow(tid, '#22c55e'); // Green glow for firing transition
    for(const arc of arcs.filter(a => a.to === tid)) {
      if (arc.arcType === 'inhibitor' || arc.arcType === 'read') continue;
      if (arc.arcType === 'reset') {
        if (liveTokens(arc.from) > 0) triggerGlow(arc.from, '#f97316');
        simTokens[arc.from] = 0;
      } else {
        triggerGlow(arc.from, '#f97316');
        simTokens[arc.from] = liveTokens(arc.from) - (arc.weight ?? 1);
      }
    }
    for(const arc of arcs.filter(a => a.from === tid)) {
      triggerGlow(arc.to, '#22c55e');
      simTokens[arc.to] = liveTokens(arc.to) + (arc.weight ?? 1);
    }
    for(const arc of arcs.filter(a => a.bidir && (a.from===tid||a.to===tid))) {
      const other = arc.from===tid ? arc.to : arc.from;
      if(nodes[other]?.type==='place') {
        simTokens[other] = liveTokens(other) + (arc.weight ?? 1);
      }
    }
  }
  refreshAutoDisable();
  render();

  if(selected) showPanel(selected);
  return true;
}






function simStep() {


  const enabled = getEnabledTransitions();

  if(enabled.length === 0) { simPause(); return; }

  fireTransitions(pickFiringSet(enabled));
}





function simPlay() {


  if(simRunning) return;
  simRunning = true;


  document.getElementById('btn-play').disabled = true;

  document.getElementById('btn-pause').disabled = false;
  if(Object.keys(simTokens).length === 0) captureInitial();
  scheduleStep();

}





function scheduleStep() {


  if(!simRunning) return;

  simTimer = setTimeout(() => {
    const enabled = getEnabledTransitions();

    if(enabled.length === 0) { simPause(); return; }
    simStep();

    if(simRunning) scheduleStep();

  }, SIM_SPEED);
}





function simPause() {
  simRunning = false;

  clearTimeout(simTimer);

  document.getElementById('btn-play').disabled = false;

  document.getElementById('btn-pause').disabled = true;

}





function captureInitial() {
  initialTokens = {};
  for(const id in nodes) {
    if(nodes[id].type === 'place') initialTokens[id] = nodes[id].tokens ?? 0;
  }
}




function simReset() {

  simPause();


  simTokens = {};


  for(const id in nodes) {

    if(nodes[id].type === 'place' && id in initialTokens) nodes[id].tokens = initialTokens[id];
    if(nodes[id].type === 'transition') nodes[id]._autoDisabled = false;


  }
  render();
  if(selected) showPanel(selected);
}





function render() { renderArcs(); renderNodes(); }



function renderArcs() {
  const layer = document.getElementById('arcs-layer');
  layer.innerHTML = '';
  arcs.forEach(arc => {
    const s=nodes[arc.from], t=nodes[arc.to];

    if(!s||!t) return;

    const {sx,sy,ex,ey} = arcEndpoints(s,t);

    const isSel = arc.id && selected === arc.id;
    const strokeCol = isSel ? '#000' : '#555';
    const strokeW = isSel ? 2.5 : 1.5;

    const isPT = s.type === 'place';
    const aType = isPT ? (arc.arcType || 'normal') : 'normal';
    let markerId = 'arr';
    if (aType === 'inhibitor') markerId = 'arr-inh';
    else if (aType === 'read') markerId = '';
    else if (aType === 'reset') markerId = 'arr-reset';

    if (!arc.points) arc.points = [];
    const pts = arc.points;

    // Build path string
    let pathStr = '';
    let textX, textY;

    if (pts.length > 0) {
      // Smooth curve through waypoints using Catmull-Rom → Cubic Bezier
      const allPts = [{x:sx,y:sy}, ...pts, {x:ex,y:ey}];
      pathStr = `M ${allPts[0].x},${allPts[0].y}`;
      for (let i = 0; i < allPts.length - 1; i++) {
        const p0 = allPts[Math.max(i - 1, 0)];
        const p1 = allPts[i];
        const p2 = allPts[i + 1];
        const p3 = allPts[Math.min(i + 2, allPts.length - 1)];
        const t = 0.35;
        const cp1x = p1.x + (p2.x - p0.x) * t;
        const cp1y = p1.y + (p2.y - p0.y) * t;
        const cp2x = p2.x - (p3.x - p1.x) * t;
        const cp2y = p2.y - (p3.y - p1.y) * t;
        pathStr += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
      }
      // Label at middle waypoint
      const midIdx = Math.floor(pts.length / 2);
      if (pts.length % 2 === 1) {
        textX = pts[midIdx].x;
        textY = pts[midIdx].y - 12;
      } else {
        const a0 = midIdx > 0 ? pts[midIdx - 1] : {x: sx, y: sy};
        const a1 = pts[midIdx];
        textX = (a0.x + a1.x) / 2;
        textY = (a0.y + a1.y) / 2 - 12;
      }
    } else {
      const isOpposite = arcs.find(o => o.from === arc.to && o.to === arc.from);
      if (isOpposite) {
        const dx = ex - sx;
        const dy = ey - sy;
        const L = Math.hypot(dx, dy) || 1;
        const nx = -dy / L;
        const ny = dx / L;
        const mx = (sx + ex) / 2;
        const my = (sy + ey) / 2;
        const cx = mx + nx * 20;
        const cy = my + ny * 20;
        pathStr = `M ${sx},${sy} Q ${cx},${cy} ${ex},${ey}`;
        textX = 0.25 * sx + 0.5 * cx + 0.25 * ex;
        textY = 0.25 * sy + 0.5 * cy + 0.25 * ey;
      } else {
        pathStr = `M ${sx},${sy} L ${ex},${ey}`;
        textX = (sx + ex) / 2;
        textY = (sy + ey) / 2;
      }
    }

    const line = svgEl('path', { d: pathStr, fill: 'none', stroke: strokeCol, 'stroke-width': strokeW });
    if (markerId) line.setAttribute('marker-end', `url(#${markerId})`);
    line.style.cursor = 'pointer';
    line.addEventListener('click',(e)=>{ e.stopPropagation(); if(mode==='select') { selected=arc.id; render(); showPanel(arc.id); } });

    // Double-click on arc to add a bend point
    line.addEventListener('dblclick',(e)=>{
      e.stopPropagation();
      if(mode !== 'select') return;
      const {x: px, y: py} = svgCoords(e);
      // Insert point at the right segment position
      const allPts = [{x:sx,y:sy}, ...pts, {x:ex,y:ey}];
      let bestIdx = pts.length; // default: append before end
      let bestDist = Infinity;
      for (let i = 0; i < allPts.length - 1; i++) {
        const ax = allPts[i].x, ay = allPts[i].y;
        const bx = allPts[i+1].x, by = allPts[i+1].y;
        const dx = bx - ax, dy = by - ay;
        const len2 = dx*dx + dy*dy;
        let t = len2 > 0 ? ((px-ax)*dx + (py-ay)*dy) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        const projX = ax + t*dx, projY = ay + t*dy;
        const d = Math.hypot(px - projX, py - projY);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      arc.points.splice(bestIdx, 0, {x: px, y: py});
      selected = arc.id;
      render(); showPanel(arc.id);
    });

    layer.appendChild(line);

    // Draw wider invisible hit area for easier clicking
    const hitArea = svgEl('path', { d: pathStr, fill: 'none', stroke: 'transparent', 'stroke-width': 12 });
    hitArea.style.cursor = 'pointer';
    hitArea.addEventListener('click',(e)=>{ e.stopPropagation(); if(mode==='select') { selected=arc.id; render(); showPanel(arc.id); } });
    hitArea.addEventListener('dblclick',(e)=>{
      line.dispatchEvent(new MouseEvent('dblclick', {clientX: e.clientX, clientY: e.clientY, bubbles: true}));
      e.stopPropagation();
    });
    layer.appendChild(hitArea);

    if(arc.bidir) {
      const {sx:bsx,sy:bsy,ex:bex,ey:bey} = arcEndpoints(t,s);
      const back = svgEl('line',{x1:bsx+2.5,y1:bsy+2.5,x2:bex+2.5,y2:bey+2.5,stroke:strokeCol,'stroke-width':strokeW,'stroke-dasharray':'4,2','marker-end':'url(#arr)'});
      back.style.cursor = 'pointer';
      back.addEventListener('click',(e)=>{ e.stopPropagation(); if(mode==='select') { selected=arc.id; render(); showPanel(arc.id); } });
      layer.appendChild(back);
    }

    const w = arc.weight ?? 1;
    const bg = svgEl('rect', {x:textX-7, y:textY-9, width:14, height:14, fill:'#fff', rx:3});
    const lbl = svgEl('text', {x:textX, y:textY+3, 'text-anchor':'middle', 'font-size':12, fill:strokeCol, 'font-family':'system-ui,sans-serif', 'font-weight':'bold'});
    lbl.textContent = w;
    layer.appendChild(bg);
    layer.appendChild(lbl);

    // Draw draggable bend point handles (only when this arc is selected)
    if (isSel) {
      pts.forEach((pt, idx) => {
        const handle = svgEl('circle', {cx: pt.x, cy: pt.y, r: 5, fill: '#4a90d9', stroke: '#fff', 'stroke-width': 1.5});
        handle.style.cursor = 'grab';

        // Drag bend point
        handle.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          if (mode !== 'select') return;
          draggingBendPoint = { arc, idx };
          e.preventDefault();
        });

        // Right-click to remove bend point
        handle.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          arc.points.splice(idx, 1);
          render(); showPanel(arc.id);
        });

        layer.appendChild(handle);
      });
    }
  });
}




function deleteArcBtn(id) {
  if(confirm('Delete this arc?')) { arcs=arcs.filter(a=>a.id!==id); selected=null; document.getElementById('panel-body').innerHTML='<p class="empty">select an element to edit</p>'; refreshAutoDisable(); render(); }
}

function applyArc(id) {
  const arc = arcs.find(a => a.id === id);
  if(!arc) return;
  const we = document.getElementById('ap-weight');
  if(we) arc.weight = Math.max(1, parseInt(we.value)||1);
  const typeEl = document.getElementById('ap-type');
  if(typeEl) arc.arcType = typeEl.value;
  refreshAutoDisable(); render(); showPanel(id);
}

function clearBendPoints(id) {
  const arc = arcs.find(a => a.id === id);
  if(arc) { arc.points = []; render(); showPanel(id); }
}




function renderNodes() {


  const layer = document.getElementById('nodes-layer');


  layer.innerHTML = '';
  const enabled = getEnabledTransitions();


  for(const id in nodes) {


    const n=nodes[id], isSel=selected===id;
    const g=svgEl('g',{}); g.style.cursor='pointer';
    const glow = activeGlows[id];

    if(n.type==='place') {
      if (glow) {
        g.appendChild(svgEl('circle',{cx:n.x,cy:n.y,r:PR+6,fill:'none',stroke:glow.color,'stroke-width':4, opacity:0.7}));
      }
      g.appendChild(svgEl('circle',{cx:n.x,cy:n.y,r:PR,fill:'#fff',stroke:isSel?'#000':'#444','stroke-width':isSel?2.5:1.5}));
      drawTokens(g, n.x, n.y, liveTokens(id));

      const lbl=svgEl('text',{x:n.x,y:n.y-PR-7,'text-anchor':'middle','font-size':13,fill:'#222','font-family':'system-ui,sans-serif'});
      lbl.textContent=n.name; g.appendChild(lbl);

      if (n.capacity !== undefined && n.capacity !== null) {
        const capLbl=svgEl('text',{x:n.x,y:n.y+PR+14,'text-anchor':'middle','font-size':11,fill:'#888','font-family':'system-ui,sans-serif'});
        capLbl.textContent='K=' + n.capacity; g.appendChild(capLbl);
      }

    } else {
      const isEnabled=enabled.includes(id);

      const strokeCol = isSel ? '#000' : '#444';

      const strokeW = isSel ? 2.5 : 1.5;
      const fillCol = isEnabled ? '#e8e8e8' : '#f4f4f4';

      if (glow) {
        g.appendChild(svgEl('rect',{x:n.x-6,y:n.y-6,width:TW+12,height:TH+12,rx:6,fill:'none',stroke:glow.color,'stroke-width':4, opacity:0.7}));
      }
      g.appendChild(svgEl('rect',{x:n.x,y:n.y,width:TW,height:TH,rx:3,fill:fillCol,stroke:strokeCol,'stroke-width':strokeW}));


      const lbl=svgEl('text',{x:n.x+TW/2,y:n.y+TH/2+5,'text-anchor':'middle','font-size':12,fill:'#222','font-family':'system-ui,sans-serif'});
      lbl.textContent=n.name; g.appendChild(lbl);


      if((n.priority||0) > 0) {


        const badge=svgEl('text',{x:n.x+4,y:n.y+10,'font-size':9,fill:'#777','font-family':'system-ui,sans-serif'});
        badge.textContent='p'+(n.priority||0); g.appendChild(badge);

      }


      const cx = n.x + TW - 7, cy = n.y + 7, r = 3.5;

      if(isEnabled) {
        g.appendChild(svgEl('circle',{cx: cx, cy: cy, r: r, fill: '#22c55e'}));
      } else {
        g.appendChild(svgEl('circle',{cx: cx, cy: cy, r: r, fill: 'none', stroke: '#aaa', 'stroke-width': 1.5}));
      }
    }

    g.addEventListener('mousedown',e=>{e.stopPropagation();onNodeDown(id,e);});

    g.addEventListener('dblclick',e=>{e.stopPropagation();if(mode==='select')startInlineRename(id);});

    makeDraggable(g, id);
    layer.appendChild(g);
  }
}


function randInt(max) {
	return Math.floor(Math.random() * max);
	}


function drawTokens(g, cx, cy, t) {
	
	
	randInt(10);


  if(t<=0) return;


  const dots=[];
  if(t===1) dots.push([0,0]);


  else if(t===2) dots.push([-7,0],[7,0]);
  else if(t===3) dots.push([0,-7],[-7,5],[7,5]);

  else if(t===4) dots.push([-7,-7],[7,-7],[-7,7],[7,7]);
  else if(t===5) dots.push([0,-9],[-8,-2],[8,-2],[-5,7],[5,7]);
	


  if(t<=5) {


    dots.forEach(([dx,dy])=>g.appendChild(svgEl('circle',{cx:cx+dx,cy:cy+dy,r:4,fill:'#333'})));

  } else {
    const lbl=svgEl('text',{x:cx,y:cy+5,'text-anchor':'middle','font-size':15,fill:'#333','font-family':'system-ui,sans-serif','font-weight':600});
    lbl.textContent=t; g.appendChild(lbl);
  }




}






//

function onNodeDown(id, e) {



  clearInlineRename();
  if(mode==='select') {

    selected=id; render(); showPanel(id);

  } else if(mode==='arc') {
    if(!arcStart) {
      arcStart=id;
    } else {


      if(arcStart===id){arcStart=null;return;}
      const s=nodes[arcStart],t=nodes[id];

      if(s.type===t.type){arcStart=null;document.getElementById('arc-prev').setAttribute('display','none');return;}
      if(!arcs.find(a=>a.from===arcStart&&a.to===id)) arcs.push({id:uid('A'), from:arcStart,to:id,bidir:false, weight: 1});

      arcStart=null; document.getElementById('arc-prev').setAttribute('display','none');
      render();
    }


  }
}




let renameEl=null;

function startInlineRename(id) {



  clearInlineRename();
  const n=nodes[id], c=nodeCenter(n);


  const fo=svgEl('foreignObject',{x:c.x-56,y:c.y-(n.type==='place'?PR+36:TH/2+36),width:112,height:28});
  const inp=document.createElement('input');



  inp.value=n.name;
  inp.style.cssText='width:100%;font-size:13px;padding:3px 7px;border:1.5px solid #555;border-radius:5px;outline:none;font-family:system-ui,sans-serif;background:#fff;color:#222;';
  fo.appendChild(inp);


  document.getElementById('canvas').appendChild(fo);


  renameEl=fo;
  setTimeout(()=>{inp.focus();inp.select();},10);
  inp.addEventListener('keydown',ev=>{


    if(ev.key==='Enter'){n.name=inp.value.trim()||n.name;clearInlineRename();render();showPanel(id);}


    if(ev.key==='Escape')clearInlineRename();


    ev.stopPropagation();
  });
  inp.addEventListener('blur',()=>{n.name=inp.value.trim()||n.name;clearInlineRename();render();showPanel(id);});
}
function clearInlineRename(){if(renameEl){renameEl.remove();renameEl=null;}}






function showPanel(id) {
  const n=nodes[id];
  const arc=arcs.find(a=>a.id===id);

  const body=document.getElementById('panel-body');

  if(!n && !arc){body.innerHTML='<p class="empty">select an element to edit</p>';return;}

  if(arc) {
    const isPT = nodes[arc.from]?.type === 'place';
    const typeOpts = isPT ? `
      <div class="prop-label">arc type</div>
      <select class="prop-input" id="ap-type" style="margin-bottom: 10px;">
        <option value="normal" ${arc.arcType === 'normal' || !arc.arcType ? 'selected' : ''}>Normal</option>
        <option value="inhibitor" ${arc.arcType === 'inhibitor' ? 'selected' : ''}>Inhibitor</option>
        <option value="read" ${arc.arcType === 'read' ? 'selected' : ''}>Read (Test)</option>
        <option value="reset" ${arc.arcType === 'reset' ? 'selected' : ''}>Reset</option>
      </select>
    ` : '';
    
    const bendCount = (arc.points || []).length;
    const bendInfo = bendCount > 0 ? `
      <div class="prop-label">bend points: ${bendCount}</div>
      <button class="prop-delete" onclick="clearBendPoints('${id}')">clear bend points</button>
      <p class="hint">double-click arc to add points<br>right-click point to remove<br>drag points to reshape</p>
    ` : `
      <p class="hint" style="margin-top:10px">double-click arc to add bend points</p>
    `;
    
    body.innerHTML=`
      ${typeOpts}
      <div class="prop-label">arc weight</div>
      <input class="prop-input" id="ap-weight" type="number" min="1" max="999" value="${arc.weight||1}">
      <button class="prop-apply" onclick="applyArc('${id}')">apply</button>
      <hr class="divider">
      ${bendInfo}
      <hr class="divider">
      <button class="prop-delete" onclick="deleteArcBtn('${id}')">delete arc</button>`;
    return;
  }

  if(n.type==='place') {



    body.innerHTML=`

      <div class="prop-label">name</div>
      <input class="prop-input" id="pp-name" value="${esc(n.name)}">

      <div class="prop-label">initial tokens</div>
      <input class="prop-input" id="pp-tokens" type="number" min="0" max="999" value="${n.tokens||0}">

      <div class="prop-label">capacity (leave empty for infinite)</div>
      <input class="prop-input" id="pp-capacity" type="number" min="1" max="999" placeholder="infinite" value="${n.capacity || ''}">

      <button class="prop-apply" onclick="applyPlace('${id}')">apply</button>
      <hr class="divider">

      <button class="prop-delete" onclick="deleteNode('${id}')">delete place</button>`;
  } else {
    const checked=n.fire?'checked':'';
    const autoWarn=n._autoDisabled?`<div class="disabled-warning">auto-disabled: not enough tokens in connected place</div>`:'';
    body.innerHTML=`
      <div class="prop-label">name</div>

      <input class="prop-input" id="tp-name" value="${esc(n.name)}">

      <div class="prop-label">fire order (priority)</div>
      <input class="prop-input" id="tp-prio" type="number" min="0" max="99" value="${n.priority||0}">

      <p class="hint">higher number fires first</p>
      <div class="toggle-row">

        <span>fire enabled</span>

        <label class="toggle"><input type="checkbox" id="tp-fire" ${checked}><span class="toggle-slider"></span></label>

      </div>
      ${autoWarn}
      <button class="prop-apply" onclick="applyTrans('${id}')">apply</button>
      <hr class="divider">
      <button class="prop-delete" onclick="deleteNode('${id}')">delete transition</button>`;
  }
}





function applyPlace(id) {
  const n=nodes[id];

  const ne=document.getElementById('pp-name'), te=document.getElementById('pp-tokens'), ce=document.getElementById('pp-capacity');
  if(ne) n.name=ne.value.trim()||n.name;

  if(te) n.tokens=Math.max(0,parseInt(te.value)||0);
  
  if(ce) {
    n.capacity = ce.value.trim() === '' ? null : Math.max(1, parseInt(ce.value) || 1);
  }
  
  if (n.capacity !== null && n.tokens > n.capacity) n.tokens = n.capacity;

  render(); showPanel(id);
}




function applyTrans(id) {


  const n=nodes[id];
  const ne=document.getElementById('tp-name'),pe=document.getElementById('tp-prio'),
        fe=document.getElementById('tp-fire');
  if(ne) n.name=ne.value.trim()||n.name;
  if(pe) n.priority=Math.max(0,parseInt(pe.value)||0);

  if(fe) n.fire=fe.checked;

  refreshAutoDisable(); render(); showPanel(id);
}




function deleteNode(id) {


  delete nodes[id];


  arcs=arcs.filter(a=>a.from!==id&&a.to!==id);
  selected=null;


  document.getElementById('panel-body').innerHTML='<p class="empty">select an element to edit</p>';
  render();
}





function deleteAll() {

  if(!confirm('Delete everything from the canvas?')) return;
  simPause();

  nodes={}; arcs=[]; selected=null; arcStart=null; simTokens={}; initialTokens={};
  clearInlineRename();

  document.getElementById('panel-body').innerHTML='<p class="empty">select an element to edit</p>';
  render();
}


const svg=document.getElementById('canvas');

// Helper: convert client mouse coords to SVG world coords (pan + zoom aware)
function svgCoords(e) {
  const r = svg.getBoundingClientRect();
  return {
    x: (e.clientX - r.left - panX) / zoomLevel,
    y: (e.clientY - r.top - panY) / zoomLevel
  };
}

// ===== CANVAS PANNING =====
let isPanning = false, panStartX = 0, panStartY = 0, panStartPX = 0, panStartPY = 0, panMoved = false;

svg.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  if (e.target.closest('g') || e.target.closest('#panel')) return;
  if (mode === 'select') {
    isPanning = true;
    panMoved = false;
    panStartX = e.clientX;
    panStartY = e.clientY;
    panStartPX = panX;
    panStartPY = panY;
    document.getElementById('canvas-wrap').classList.add('panning');
    e.preventDefault();
  }
});

svg.addEventListener('mousemove', e => {
  if (isPanning) {
    const dx = e.clientX - panStartX;
    const dy = e.clientY - panStartY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) panMoved = true;
    panX = panStartPX + dx;
    panY = panStartPY + dy;
    applyTransform();
  }
});

document.addEventListener('mouseup', () => {
  if (isPanning) {
    isPanning = false;
    document.getElementById('canvas-wrap').classList.remove('panning');
  }
});


svg.addEventListener('click',e=>{

  if(e.target.closest('g')) return;
  if(panMoved) { panMoved = false; return; }

  const {x: mx, y: my} = svgCoords(e);

  clearInlineRename();
  if(mode==='place') {

    const id=uid('P'), num=Object.values(nodes).filter(n=>n.type==='place').length+1;
    nodes[id]={type:'place',name:'P'+num,x:mx,y:my,tokens:0,capacity:null};
    if(simRunning) simTokens[id]=0;

    render();
  } else if(mode==='transition') {
    const id=uid('T'), num=Object.values(nodes).filter(n=>n.type==='transition').length+1;

    nodes[id]={type:'transition',name:'T'+num,x:mx-TW/2,y:my-TH/2,fire:true,priority:0};

    render();
  } else if(mode==='select') {
    selected=null;

    document.getElementById('panel-body').innerHTML='<p class="empty">select an element to edit</p>';
    render();
  }
});




svg.addEventListener('mousemove',e=>{
  if((mode==='arc')&&arcStart) {
    const sc=nodeCenter(nodes[arcStart]);
    const {x: mx, y: my} = svgCoords(e);
    const prev=document.getElementById('arc-prev');
    prev.setAttribute('display','');
    prev.setAttribute('x1',sc.x); prev.setAttribute('y1',sc.y);
    prev.setAttribute('x2', mx); prev.setAttribute('y2', my);
  }
});




document.getElementById('canvas-wrap').addEventListener('contextmenu',e=>{


  e.preventDefault();

  if(mode!=='select'||!selected) return;


  if(confirm('Delete "'+nodes[selected].name+'"?')) deleteNode(selected);
});





let draggingNode = null;
let dragStartX = 0;
let dragStartY = 0;
let dragMoved = false;
let draggingBendPoint = null;

document.addEventListener('mousemove', e => {
  // Handle bend point dragging
  if (draggingBendPoint && mode === 'select') {
    const {x: px, y: py} = svgCoords(e);
    draggingBendPoint.arc.points[draggingBendPoint.idx] = {x: px, y: py};
    render();
    return;
  }
  if(!draggingNode || mode !== 'select') return;
  const dx = (e.clientX - dragStartX) / zoomLevel;
  const dy = (e.clientY - dragStartY) / zoomLevel;
  if(Math.abs(e.clientX - dragStartX) > 2 || Math.abs(e.clientY - dragStartY) > 2) dragMoved = true;
  nodes[draggingNode].x += dx;
  nodes[draggingNode].y += dy;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  render();
});

document.addEventListener('mouseup', e => {
  if (draggingBendPoint) {
    draggingBendPoint = null;
    return;
  }
  if(draggingNode && !dragMoved && mode === 'select' && nodes[draggingNode].type === 'transition') {
    const tid = draggingNode;
    const { consumed, produced, requires, forbids } = getTransitionImpact(tid);
    
    let canFire = true;
    for(const pid in requires) {
      if(liveTokens(pid) < requires[pid]) { canFire=false; break; }
    }
    for(const pid in forbids) {
      if(liveTokens(pid) >= forbids[pid]) { canFire=false; break; }
    }
    if (canFire) {
      const affected = new Set([...Object.keys(consumed), ...Object.keys(produced)]);
      for(const pid of affected) {
        const p = nodes[pid];
        if (p && p.capacity !== undefined && p.capacity !== null) {
          const cAmt = consumed[pid] === 'ALL' ? liveTokens(pid) : (consumed[pid] || 0);
          if (liveTokens(pid) - cAmt + (produced[pid]||0) > p.capacity) {
            canFire = false; break;
          }
        }
      }
    }

    if(canFire) {
      if(Object.keys(simTokens).length === 0) captureInitial();
      fireTransitions([tid]);
    }
  }
  draggingNode = null;
});

function makeDraggable(g,id) {
  g.addEventListener('mousedown',e=>{
    if(mode!=='select')return;
    draggingNode = id;
    dragMoved = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    e.preventDefault();
  });
}


setMode('select');

function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  modelFileName = file.name.replace(/\.xml$/i, '');
  updateTitleBar();
  const reader = new FileReader();
  reader.onload = e => importPNML(e.target.result);
  reader.readAsText(file);
  event.target.value = '';
}

function importPNML(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  
  simPause();
  nodes = {}; arcs = []; selected = null; arcStart = null; simTokens = {}; initialTokens = {};
  clearInlineRename();

  const places = doc.querySelectorAll('place');
  places.forEach(p => {
    const id = p.getAttribute('id');
    const nameEl = p.querySelector('name > value');
    const name = nameEl ? nameEl.textContent : id;
    const pos = p.querySelector('graphics > position');
    const x = pos ? parseFloat(pos.getAttribute('x')) : 0;
    const y = pos ? parseFloat(pos.getAttribute('y')) : 0;
    
    const initMarkingEl = p.querySelector('initialMarking > value');
    let tokens = 0;
    if (initMarkingEl) {
      const val = initMarkingEl.textContent; 
      const match = val.match(/\d+$/);
      if (match) tokens = parseInt(match[0]);
    }
    
    const capacityEl = p.querySelector('capacity > value');
    let capacity = null;
    if (capacityEl) {
      const capVal = parseInt(capacityEl.textContent);
      if (capVal > 0) capacity = capVal;
    }

    nodes[id] = { type: 'place', name, x, y, tokens, capacity };
  });

  const transitions = doc.querySelectorAll('transition');
  transitions.forEach(t => {
    const id = t.getAttribute('id');
    const nameEl = t.querySelector('name > value');
    const name = nameEl ? nameEl.textContent : id;
    const pos = t.querySelector('graphics > position');
    const x = pos ? parseFloat(pos.getAttribute('x')) : 0;
    const y = pos ? parseFloat(pos.getAttribute('y')) : 0;
    
    const priorityEl = t.querySelector('priority > value');
    const priority = priorityEl ? parseInt(priorityEl.textContent) : 0;
    
    nodes[id] = { type: 'transition', name, x, y, fire: true, priority }; 
  });

  const xmlArcs = doc.querySelectorAll('arc');
  xmlArcs.forEach(a => {
    const id = a.getAttribute('id');
    const source = a.getAttribute('source');
    const target = a.getAttribute('target');
    
    const inscEl = a.querySelector('inscription > value');
    let weight = 1;
    if (inscEl) {
      const val = inscEl.textContent; 
      const match = val.match(/\d+$/);
      if (match) weight = parseInt(match[0]);
    }
    
    const typeEl = a.querySelector('type');
    let arcType = 'normal';
    if (typeEl) arcType = typeEl.getAttribute('value') || 'normal';
    
    arcs.push({ id: id || uid('A'), from: source, to: target, bidir: false, weight, arcType });
  });

  document.getElementById('panel-body').innerHTML = '<p class="empty">select an element to edit</p>';
  refreshAutoDisable();
  render();
}

function buildPNML() {
  let xml = `<?xml version="1.0" encoding="ISO-8859-1"?><pnml>\n<net id="Net-One" type="P/T net">\n`;
  xml += `<token id="Default" enabled="true" red="0" green="0" blue="0"/>\n`;
  for(const id in nodes) {
    const n = nodes[id];
    if (n.type === 'place') {
      xml += `<place id="${esc(id)}">\n`;
      xml += `<graphics><position x="${n.x}" y="${n.y}"/></graphics>\n`;
      xml += `<name><value>${esc(n.name)}</value><graphics><offset x="0.0" y="0.0"/></graphics></name>\n`;
      xml += `<initialMarking><value>Default,${n.tokens||0}</value><graphics><offset x="0.0" y="0.0"/></graphics></initialMarking>\n`;
      xml += `<capacity><value>${n.capacity||0}</value></capacity>\n`;
      xml += `</place>\n`;
    } else if (n.type === 'transition') {
      xml += `<transition id="${esc(id)}">\n`;
      xml += `<graphics><position x="${n.x}" y="${n.y}"/></graphics>\n`;
      xml += `<name><value>${esc(n.name)}</value><graphics><offset x="0.0" y="0.0"/></graphics></name>\n`;
      xml += `<priority><value>${n.priority||0}</value></priority>\n`;
      xml += `</transition>\n`;
    }
  }
  arcs.forEach((a, i) => {
    xml += `<arc id="arc${i}" source="${esc(a.from)}" target="${esc(a.to)}">\n`;
    xml += `<inscription><value>Default,${a.weight||1}</value><graphics/></inscription>\n`;
    xml += `<type value="${esc(a.arcType || 'normal')}"/>\n`;
    xml += `</arc>\n`;
    if (a.bidir) {
      xml += `<arc id="arc${i}_back" source="${esc(a.to)}" target="${esc(a.from)}">\n`;
      xml += `<inscription><value>Default,${a.weight||1}</value><graphics/></inscription>\n`;
      xml += `<type value="${esc(a.arcType || 'normal')}"/>\n`;
      xml += `</arc>\n`;
    }
  });
  xml += `</net>\n</pnml>`;
  return xml;
}

function downloadFile(content, name, type) {
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function saveModel() {
  const xml = buildPNML();
  if (modelFileName) {
    downloadFile(xml, modelFileName + '.xml', 'text/xml');
  } else {
    saveModelAs();
  }
}

function saveModelAs() {
  const xml = buildPNML();
  const name = prompt('Save as (file name):', modelFileName || 'model');
  if (!name) return;
  modelFileName = name.replace(/\.xml$/i, '');
  updateTitleBar();
  downloadFile(xml, modelFileName + '.xml', 'text/xml');
}

function newModel() {
  if (!confirm('Create a new empty model? Unsaved changes will be lost.')) return;
  simPause();
  nodes = {}; arcs = []; selected = null; arcStart = null; simTokens = {}; initialTokens = {};
  clearInlineRename();
  modelFileName = null;
  updateTitleBar();
  document.getElementById('panel-body').innerHTML = '<p class="empty">select an element to edit</p>';
  render();
}

function togglePanel() {
  const p = document.getElementById('panel');
  p.style.display = p.style.display === 'none' ? 'flex' : 'none';
}

// Keep exportPNML as alias for backward compatibility
function exportPNML() { saveModelAs(); }

function exportMaude() {
  // Helper to get clean Maude-safe name
  function mName(id) {
    const n = nodes[id];
    return n ? n.name.replace(/\s+/g, '_') : id;
  }

  // Collect place and transition IDs
  const placeIds = Object.keys(nodes).filter(id => nodes[id].type === 'place');
  const transIds = Object.keys(nodes).filter(id => nodes[id].type === 'transition');

  // Detect source transitions (no input arcs at all)
  function isSourceTransition(tid) {
    return !arcs.some(a => a.to === tid);
  }

  // Detect structural conflicts: transitions sharing input places (normal arcs only)
  function getConflictingTransitions(tid) {
    const myInputPlaces = new Set();
    arcs.forEach(a => {
      if (a.to === tid && (a.arcType || 'normal') === 'normal') {
        myInputPlaces.add(a.from);
      }
    });
    const conflicting = new Set();
    transIds.forEach(otherTid => {
      if (otherTid === tid) return;
      arcs.forEach(a => {
        if (a.to === otherTid && (a.arcType || 'normal') === 'normal' && myInputPlaces.has(a.from)) {
          conflicting.add(otherTid);
        }
      });
    });
    return conflicting;
  }

  // Detect transitions whose firing produces tokens into a place connected
  // to tid via inhibitor arc (firing such transitions could disable tid)
  function getInhibitorAffectedBy(tid) {
    // Find all output places of tid
    const outputPlaces = new Set();
    arcs.forEach(a => {
      if (a.from === tid) outputPlaces.add(a.to);
    });
    // Find transitions that have inhibitor arcs from those output places
    const affected = new Set();
    arcs.forEach(a => {
      if ((a.arcType || 'normal') === 'inhibitor' && outputPlaces.has(a.from)) {
        affected.add(a.to); // the transition connected via inhibitor
      }
    });
    return affected;
  }

  // NOTE: All transitions start as enable(Ti,false) in the initial configuration.
  // Maude's equational logic (ceq rules) will automatically evaluate and
  // promote transitions to enable(Ti,true) before any rewrite rule fires.
  // This is how rewriting logic works: equations have priority over rules.

  // --- Begin generating Maude code ---
  let maude = '';
  maude += `mod PETRI-NET is\n`;
  maude += `    protecting BOOL .\n`;
  maude += `    protecting INT .\n`;
  maude += `    including CONFIGURATION .\n\n`;
  maude += `    op PLACE : -> Cid . --- 'Cid' Class Id from CONFIGURATION Module\n`;
  maude += `    op N :_ : Int -> Attribute [gather(&)] . --- 'Attribute' from CONFIGURATION Module\n\n`;
  maude += `    ops ${placeIds.map(mName).join(' ')} : -> Oid .\n`;
  maude += `    ops ${transIds.map(mName).join(' ')} : -> Oid .\n`;
  maude += `    op enable(_,_) : Oid Bool -> Msg .\n\n`;
  maude += `    op initial : -> Configuration .\n\n`;
  maude += `    vars x y z : Int .\n`;
  maude += `    var t : Bool .\n\n`;

  // Initial configuration
  maude += `    eq initial = \n        `;
  placeIds.forEach(pid => {
    maude += `< ${mName(pid)} : PLACE | N : ${nodes[pid].tokens || 0} > `;
  });
  transIds.forEach(tid => {
    maude += `enable(${mName(tid)},false) `;
  });
  maude += `.\n\n`;

  // Generate rules for each transition
  transIds.forEach(tid => {
    const tN = mName(tid);
    const impact = getTransitionImpact(tid);
    const isSource = isSourceTransition(tid);
    const conflicts = getConflictingTransitions(tid);
    const inhAffected = getInhibitorAffectedBy(tid);

    // --- Enabling equation (skip for source transitions) ---
    if (!isSource) {
      let varIdx = 0;
      const pVarMap = {};

      let lhsPlaces = '', rhsPlaces = '', conditions = [];

      // Normal/read arcs -> requires
      for (const pid in impact.requires) {
        const v = String.fromCharCode(120 + varIdx); // x, y, z...
        varIdx++;
        pVarMap[pid] = v;
        lhsPlaces += `< ${mName(pid)} : PLACE | N : ${v} > `;
        rhsPlaces += `< ${mName(pid)} : PLACE | N : ${v} > `;
        conditions.push(`(${v} >= ${impact.requires[pid]})`);
      }

      // Inhibitor arcs -> forbids
      for (const pid in impact.forbids) {
        if (!pVarMap[pid]) {
          const v = String.fromCharCode(120 + varIdx);
          varIdx++;
          pVarMap[pid] = v;
          lhsPlaces += `< ${mName(pid)} : PLACE | N : ${v} > `;
          rhsPlaces += `< ${mName(pid)} : PLACE | N : ${v} > `;
        }
        conditions.push(`(${pVarMap[pid]} == 0 )`);
      }

      if (conditions.length > 0) {
        maude += `    ceq[enable-${tN}] :\n`;
        maude += `        ${lhsPlaces}enable(${tN},false) = \n`;
        maude += `        ${rhsPlaces}enable(${tN},true) \n`;
        maude += `        if ${conditions.join(' and ')} .\n\n`;
      } else {
        maude += `    eq[enable-${tN}] :\n`;
        maude += `        enable(${tN},false) = \n`;
        maude += `        enable(${tN},true) .\n\n`;
      }
    }

    // --- Firing rule ---
    let varIdx = 0;
    const fireVarMap = {};

    // Collect all places involved in the firing
    const firePlaces = new Set();
    for (const pid in impact.consumed) firePlaces.add(pid);
    for (const pid in impact.produced) firePlaces.add(pid);
    // Inhibitor-connected places appear in LHS but don't change
    for (const pid in impact.forbids) firePlaces.add(pid);

    let fireLhs = '', fireRhs = '';

    for (const pid of firePlaces) {
      const v = String.fromCharCode(120 + varIdx); // x, y, z...
      varIdx++;
      fireVarMap[pid] = v;

      fireLhs += `< ${mName(pid)} : PLACE | N : ${v} > `;

      // Compute new token value
      const isInhibitorOnly = (impact.forbids[pid] !== undefined) && 
                               (impact.consumed[pid] === undefined) && 
                               (impact.produced[pid] === undefined);
      
      if (isInhibitorOnly) {
        // Place connected via inhibitor: tokens don't change
        fireRhs += `< ${mName(pid)} : PLACE | N : ${v} > `;
      } else if (impact.consumed[pid] === 'ALL') {
        fireRhs += `< ${mName(pid)} : PLACE | N : 0 > `;
      } else {
        const c = impact.consumed[pid] || 0;
        const p = impact.produced[pid] || 0;
        const diff = p - c;
        if (diff > 0) fireRhs += `< ${mName(pid)} : PLACE | N : ${v} + ${diff} > `;
        else if (diff < 0) fireRhs += `< ${mName(pid)} : PLACE | N : ${v} - ${Math.abs(diff)} > `;
        else fireRhs += `< ${mName(pid)} : PLACE | N : ${v} > `;
      }
    }

    // Source transition stays enabled after firing
    const enableAfterFire = isSource ? 'true' : 'false';

    // Conflict messages: add enable(Tj, t) to LHS and enable(Tj, false) to RHS
    let conflictLhs = '', conflictRhs = '';
    const allToDisable = new Set([...conflicts, ...inhAffected]);
    allToDisable.forEach(cTid => {
      conflictLhs += `enable(${mName(cTid)},t) `;
      conflictRhs += `enable(${mName(cTid)},false) `;
    });

    maude += `    rl[fire-${tN}] : \n`;
    maude += `        ${fireLhs}enable(${tN},true) ${conflictLhs}=> \n`;
    maude += `        ${fireRhs}enable(${tN},${enableAfterFire}) ${conflictRhs}.\n\n`;
  });

  maude += `endm\n`;

  const fileName = prompt('Enter file name for Maude export:', 'model');
  if (!fileName) return;
  const maudeFileName = fileName.endsWith('.maude') ? fileName : fileName + '.maude';

  // Append helpful Maude CLI usage hints
  maude += `\n\n`;
  maude += `--- ============================================================\n`;
  maude += `--- Useful commands to run this model in Maude\n`;
  maude += `--- ============================================================\n`;
  maude += `\n`;
  maude += `--- Start Maude and load this file:\n`;
  maude += `---   ./maude.linux64\n`;
  maude += `---   load ${maudeFileName} .\n`;
  maude += `\n`;
  maude += `--- Show the module to verify it is loaded correctly:\n`;
  maude += `---   show module PETRI-NET .\n`;
  maude += `\n`;
  maude += `--- Execute one step of the model starting from initial configuration:\n`;
  maude += `---   rew [1] initial .\n`;
  maude += `\n`;
  maude += `--- Execute 5 steps:\n`;
  maude += `---   rew [5] initial .\n`;
  maude += `\n`;
  maude += `--- Execute until terminal state (no more rules apply):\n`;
  maude += `---   rew initial .\n`;
  maude += `\n`;
  maude += `--- Search all reachable configurations from initial:\n`;
  maude += `---   search initial =>* C:Configuration .\n`;
  maude += `\n`;
  maude += `--- Search reachable configurations within 4 steps:\n`;
  maude += `---   search [4] initial =>* C:Configuration .\n`;
  maude += `\n`;
  maude += `--- Show the complete path from initial to a specific state (e.g., state 7):\n`;
  maude += `---   show path 7 .\n`;
  maude += `\n`;

  const blob = new Blob([maude], {type: 'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = maudeFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
// Load default model
fetch('trafic light.xml')
  .then(res => {
    if(!res.ok) throw new Error("Not found");
    return res.text();
  })
  .then(text => {
    modelFileName = 'trafic light';
    updateTitleBar();
    importPNML(text);
  })
  .catch(err => console.log("Default model not loaded:", err));

// ===== EXAMPLES DISCOVERY =====
const EXAMPLE_FILES = [
  'example_newpaper_fig_a.xml',
  'example_oldpapper_fig_a.xml',
  'example_oldpapper_fig_b.xml'
];

function loadExample(filename) {
  // If we bundled the XML via examples_data.js (to bypass local file:// fetch blocks)
  if (typeof EXAMPLES_DATA !== 'undefined' && EXAMPLES_DATA[filename]) {
    try {
      modelFileName = filename.replace(/\.xml$/i, '');
      updateTitleBar();
      importPNML(EXAMPLES_DATA[filename]);
      setStatusHint('Loaded example: ' + modelFileName);
    } catch(e) {
      alert('Could not load example: ' + filename);
      console.error(e);
    }
    return;
  }

  // Fallback to fetch for remote host
  fetch(filename)
    .then(res => {
      if(!res.ok) throw new Error("File not found: " + filename);
      return res.text();
    })
    .then(text => {
      modelFileName = filename.replace(/\.xml$/i, '');
      updateTitleBar();
      importPNML(text);
      setStatusHint('Loaded example: ' + modelFileName);
    })
    .catch(err => {
      alert('Could not load example: ' + filename);
      console.error(err);
    });
}

function buildExamplesMenu() {
  const menu = document.getElementById('examples-menu');
  if (!menu) return;
  // Bypassing the HEAD check because local file:// protocols block it
  renderExamplesMenu(EXAMPLE_FILES);
}

function renderExamplesMenu(files) {
  const menu = document.getElementById('examples-menu');
  if (!menu) return;
  
  if (files.length === 0) {
    menu.innerHTML = '<div class="menu-action" style="color:#999;cursor:default;">No examples found</div>';
    return;
  }
  
  menu.innerHTML = '';
  files.sort().forEach(f => {
    const label = f.replace(/^example_/, '').replace(/\.xml$/i, '').replace(/_/g, ' ');
    const div = document.createElement('div');
    div.className = 'menu-action';
    div.textContent = '📄 ' + label;
    div.addEventListener('click', () => loadExample(f));
    menu.appendChild(div);
  });
}

// Discover examples on startup
buildExamplesMenu();

// ===== STATUS BAR =====
function setStatusHint(text) {
  const el = document.getElementById('statusbar-hint');
  if (el) el.textContent = text;
}

function updateStatusInfo() {
  const el = document.getElementById('statusbar-info');
  if (!el) return;
  const pCount = Object.values(nodes).filter(n => n.type === 'place').length;
  const tCount = Object.values(nodes).filter(n => n.type === 'transition').length;
  const aCount = arcs.length;
  el.textContent = `Places: ${pCount} | Transitions: ${tCount} | Arcs: ${aCount}`;
}

// Patch render to also update status bar
const _origRender = render;
render = function() {
  _origRender();
  updateStatusInfo();
};

// Contextual hints per mode
const _origSetMode = setMode;
setMode = function(m) {
  _origSetMode(m);
  const hints = {
    select: 'Click to select elements. Drag to move. Click a transition to fire it.',
    place: 'Click on the canvas to add a new place (circle).',
    transition: 'Click on the canvas to add a new transition (rectangle).',
    arc: 'Click a source node, then click a target node to draw an arc.'
  };
  setStatusHint(hints[m] || 'Ready.');
};

// ===== HELP DIALOG =====
function showHelp() {
  const msg = `
━━━ PETRI NET EDITOR — QUICK START GUIDE ━━━

🔧 BUILDING A MODEL:
  • Select "place" or "transition" tool, click canvas to add nodes
  • Select "arc" tool, click source node then target node
  • Double-click on a node label to rename it
  • Use the properties panel to set tokens, capacity, weights
  
🎯 ARC TYPES (Place → Transition only):
  • Normal: consumes tokens (weight = amount)
  • Inhibitor: transition enabled only if place has < weight tokens
  • Read (Test): checks tokens without consuming
  • Reset: removes ALL tokens from place on fire
  
🔄 SIMULATION:
  • Green dot (●) on a transition = ENABLED (can fire)
  • Click an enabled transition to fire it manually
  • Use ▶ Play for automatic simulation
  • Use ⏭ Step for single-step execution
  
📐 ARC BEND POINTS:
  • Double-click on an arc to add a bend point
  • Drag the blue handles to reshape
  • Right-click a handle to remove it
  
💾 FILE OPERATIONS:
  • Ctrl+S = Save, Ctrl+O = Open, Ctrl+N = New
  • Export as Maude = generates formal verification code
  
📚 EXAMPLES:
  • Use the "Examples" menu to load built-in templates
`.trim();
  alert(msg);
}

// ===== PANEL DRAG =====
(function() {
  const panel = document.getElementById('panel');
  const header = document.getElementById('panel-header');
  let isDragging = false, startX, startY, startLeft, startTop;
  header.addEventListener('mousedown', e => {
    isDragging = true;
    const rect = panel.getBoundingClientRect();
    const parentRect = panel.parentElement.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left - parentRect.left;
    startTop = rect.top - parentRect.top;
    panel.style.right = 'auto';
    panel.style.left = startLeft + 'px';
    panel.style.top = startTop + 'px';
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    panel.style.left = (startLeft + dx) + 'px';
    panel.style.top = (startTop + dy) + 'px';
  });
  document.addEventListener('mouseup', () => { isDragging = false; });
})();

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
  if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveModel(); }
  if (e.ctrlKey && e.key === 'o') { e.preventDefault(); document.getElementById('file-import').click(); }
  if (e.ctrlKey && e.key === 'n') { e.preventDefault(); newModel(); }
});
