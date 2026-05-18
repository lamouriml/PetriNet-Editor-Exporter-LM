# Petri Net Editor & Simulator

[🌎 اقرأ باللغة العربية (Read in Arabic)](README_AR.md)

Welcome to the **Petri Net Editor & Simulator**—a zero-dependency, professional-grade visual Petri Net modeler, interactive simulator, and formal verification compiler. Designed for both academic research and engineering design, this web application provides an intuitive graphical interface to create, simulate, and export Place/Transition (P/T) nets with high-level arc semantics.

This editor allows researchers and developers to visually design complex Petri Net systems and compile them directly into formal [Maude rewriting logic](https://maude.cs.illinois.edu/) specifications to perform state-space exploration, reachability analysis, and model checking.

---

## The Web App link

-   [petrinet-editor.netlify.app/](https://petrinet-editor.netlify.app/)

---

## 🚀 Quick Start

1. Select the **Place** or **Transition** tool from the toolbar and click on the canvas to place nodes.
2. Select the **Arc** tool, then click the source node and target node to connect them.
3. Select the **Text** tool (📝) to add notes directly onto the canvas for model documentation.
4. Switch to **Select** mode to interact, drag elements, edit properties (e.g. text content), or manually fire transitions.
5. Click **Play** or **Step** to run the simulator!

---

## 🎨 Key Features & Architecture

### 1. Robust Visual Editor

- **Multi-Tab Workspace**: Edit multiple Petri Net models simultaneously. Switch between tabs without losing your panning, zooming, or simulation progress.
- **Vector Canvas with Pan & Zoom**: Seamlessly navigate large models. In `Select` mode, drag the empty canvas space to pan around, and use **Zoom In (+)** / **Zoom Out (-)** to scale your design.
- **Element Properties Panel**: Select any place, transition, arc, or text note to configure properties such as names, initial markings, capacities, weights, priorities, and text content.
- **Inline Editing**: Double-click on any place or transition name to rename it instantly.
- **Drag-and-Drop Arc Routing**: Double-click on any arc to create a bend point. Drag the bend point to custom route arcs around elements. Right-click on a bend point to remove it, or use the properties panel to clear all points.
- **Canvas Text Annotations**: Use the Text tool to write multi-line documentation directly on the canvas, which is perfectly preserved within the model file.

### 2. Multi-Type Arc Semantics

Design expressive modeling logic using four distinct arc types, fully supported in both the graphical simulator and the compiled Maude output:

1. **Normal Arcs**: Transfer a specific number of tokens (defined by the arc weight) from places to transitions or transitions to places.
2. **Inhibitor Arcs** ($\circ$): Prevent a transition from firing if the connected place has tokens greater than or equal to the arc weight.
3. **Read (Test) Arcs**: Require a minimum token count to enable a transition, but **do not consume** any tokens when it fires.
4. **Reset Arcs** ($\gg$): Completely drain all tokens from a place (setting it to 0) upon transition firing, regardless of the marking.
5. **Dynamic Drains**: Dynamically consume tokens equal to a variable mathematical expression $M(P) - threshold$. Bypasses runtime subtraction by simply hard-resetting the place tokens to the defined threshold weight.

### 3. Dynamic Simulation Engine

- **Visual Liveness Indicators**:
  - Enabled transitions are marked with a green status badge (🟢).
  - Disabled transitions are marked with an empty status badge (⚪).
  - Transitions are automatically grayed out if firing them would violate place capacity constraints ($K$ limit) or if connected input places lack sufficient tokens.
- **Conflict & Priority Resolution**: Customize the `Fire Order (Priority)` on transitions. Transitions with a higher priority will fire first in the simulator and Maude specifications. If priorities are equal, a random candidate is selected.
- **Visual Glow Effects**: Firing transitions trigger high-fidelity visual alerts, showing green glows for token production and orange glows for token consumption.
- **Control Suite**: Continuous play (with adjustable speed), single-step execution, and instant state resets back to the initial marking.

### 4. Interoperability & Formal Verification

- **Petri Net Markup Language (PNML)**: Save and load model structures in standard-compliant PNML (XML) files. Full support for standard `<labels>` export for text annotations.
- **Native File System Saving**: Instead of repeatedly downloading multiple files (`model(1).xml`), the app uses the browser's modern File System Access API to directly overwrite your target local file when you click **Save (Ctrl+S)**.
- **Built-in Academic Examples**: Instantly load pre-configured models directly from the `Examples` dropdown menu. (Update the list anytime by running `node build_examples.js` to automatically bundle new XML files in the `examples` folder).
- **Formal Maude Compiler**: Instantly compile your graphical Petri Net into a mathematical Maude rewriting logic specification (`.maude`).

---

## 📝 Formal Verification with Maude

The Maude exporter generates a mathematically rigorous model of your Petri Net as a rewrite system.

### Maude Code Generation Architecture

1. **Algebraic Signatures**: Maps places to objects with token counts as attributes using the simplified Object-Oriented Rewriting Logic Semantics notation (e.g., `< P1 | N : 3 >`).
2. **Transition Messaging**: Represents transition enabling status as message objects: `enabled(TransitionID, IsEnabled)`. Source transitions are inherently unconditionally enabled.
3. **Conditional Equations (`ceq`)**: Evaluates requirements and inhibitor constraints equational-style (labeled `EN-T1`). Equational logic executes with higher priority, automatically promoting transition enabling statuses prior to rewrite execution.
4. **Rewrite Rules (`rl`)**: Models structural token changes, resets, capacities, and conflict propagation as transition rules (labeled `FI-T1`).

### Running Verification in Maude

Once you export your model (e.g., `model.maude`), start the Maude interpreter and execute any of these commands:

```maude
--- 1. Load the exported model
load model.maude .

--- 2. Execute 1 step of the Petri Net starting from the initial marking
rew [1] initial .

--- 3. Execute until a deadlock or terminal state is reached
rew initial .

--- 4. Search all reachable states to find potential deadlocks or invariants
search initial =>* C:Configuration .

--- 5. Search for states where a specific place (e.g., P3) accumulates more than 5 tokens
search initial =>* < P3 | N : x > C:Configuration when x > 5 .
```

---

> [!NOTE]
> All graphic interfaces and controls are fully self-contained. The simulator runs client-side in the web browser, making it completely lightweight and portable.

> [!TIP]
> Use the **Double-click Arc** feature in `Select` mode to cleanly direct arrows around nodes, producing visually appealing diagrams for papers or presentations.
