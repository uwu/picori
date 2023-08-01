// node_modules/.pnpm/shittier-maverick-signals@5.11.2/node_modules/shittier-maverick-signals/dist/prod/symbols.js
var SCOPE = Symbol(0);

// node_modules/.pnpm/shittier-maverick-signals@5.11.2/node_modules/shittier-maverick-signals/dist/prod/core.js
var scheduledEffects = false;
var runningEffects = false;
var currentScope = null;
var currentObserver = null;
var currentObservers = null;
var currentObserversIndex = 0;
var effects = [];
var defaultContext = {};
var NOOP = () => {
};
var STATE_CLEAN = 0;
var STATE_CHECK = 1;
var STATE_DIRTY = 2;
var STATE_DISPOSED = 3;
function flushEffects() {
  scheduledEffects = true;
  queueMicrotask(runEffects);
}
function runEffects() {
  if (!effects.length) {
    scheduledEffects = false;
    return;
  }
  runningEffects = true;
  for (let i = 0; i < effects.length; i++) {
    if (effects[i].$st !== STATE_CLEAN)
      runTop(effects[i]);
  }
  effects = [];
  scheduledEffects = false;
  runningEffects = false;
}
function runTop(node) {
  let ancestors = [node];
  while (node = node[SCOPE]) {
    if (node.$e && node.$st !== STATE_CLEAN)
      ancestors.push(node);
  }
  for (let i = ancestors.length - 1; i >= 0; i--) {
    updateCheck(ancestors[i]);
  }
}
function root(init) {
  const scope = createScope();
  return compute(scope, !init.length ? init : init.bind(null, dispose.bind(scope)), null);
}
function onDispose(disposable) {
  if (!disposable || !currentScope)
    return disposable || NOOP;
  const node = currentScope;
  if (!node.$d) {
    node.$d = disposable;
  } else if (Array.isArray(node.$d)) {
    node.$d.push(disposable);
  } else {
    node.$d = [node.$d, disposable];
  }
  return function removeDispose() {
    if (node.$st === STATE_DISPOSED)
      return;
    disposable.call(null);
    if (isFunction(node.$d)) {
      node.$d = null;
    } else if (Array.isArray(node.$d)) {
      node.$d.splice(node.$d.indexOf(disposable), 1);
    }
  };
}
function dispose(self = true) {
  if (this.$st === STATE_DISPOSED)
    return;
  let head = self ? this.$ps ?? this[SCOPE] : this, current = this.$ns;
  while (current && current[SCOPE] === this) {
    dispose.call(current, true);
    disposeNode(current);
    current = current.$ns;
  }
  if (self)
    disposeNode(this);
  if (current)
    current.$ps = !self ? this : this.$ps;
  if (head)
    head.$ns = current;
}
function disposeNode(node) {
  node.$st = STATE_DISPOSED;
  if (node.$d)
    emptyDisposal(node);
  if (node.$s)
    removeSourceObservers(node, 0);
  if (node.$ps)
    node.$ps.$ns = null;
  node[SCOPE] = null;
  node.$s = null;
  node.$o = null;
  node.$ps = null;
  node.$cx = defaultContext;
  node.$eh = null;
}
function emptyDisposal(scope) {
  try {
    if (Array.isArray(scope.$d)) {
      for (let i = scope.$d.length - 1; i >= 0; i--) {
        const callable = scope.$d[i];
        callable.call(callable);
      }
    } else {
      scope.$d.call(scope.$d);
    }
    scope.$d = null;
  } catch (error) {
    handleError(scope, error);
  }
}
function compute(scope, compute2, observer) {
  const prevScope = currentScope, prevObserver = currentObserver;
  currentScope = scope;
  currentObserver = observer;
  let comp;
  try {
    comp = compute2.call(scope);
  } finally {
    if (comp?.then)
      return new Promise((res, rej) => {
        comp.then((val) => res(val));
        comp.catch((err) => rej(err));
        comp.finally(() => {
          currentScope = prevScope;
          currentObserver = prevObserver;
        });
      });
    currentScope = prevScope;
    currentObserver = prevObserver;
    return comp;
  }
}
function handleError(scope, error) {
  if (!scope || !scope.$eh)
    throw error;
  let i = 0, len = scope.$eh.length, coercedError = coerceError(error);
  for (i = 0; i < len; i++) {
    try {
      scope.$eh[i](coercedError);
      break;
    } catch (error2) {
      coercedError = coerceError(error2);
    }
  }
  if (i === len)
    throw coercedError;
}
function coerceError(error) {
  return error instanceof Error ? error : Error(JSON.stringify(error));
}
function read() {
  if (this.$st === STATE_DISPOSED)
    return this.$v;
  if (currentObserver && !this.$e) {
    if (!currentObservers && currentObserver.$s && currentObserver.$s[currentObserversIndex] == this) {
      currentObserversIndex++;
    } else if (!currentObservers)
      currentObservers = [this];
    else
      currentObservers.push(this);
  }
  if (this.$c)
    updateCheck(this);
  return this.$v;
}
function write(newValue) {
  const value = isFunction(newValue) ? newValue(this.$v) : newValue;
  if (this.$ch(this.$v, value)) {
    this.$v = value;
    if (this.$o) {
      for (let i = 0; i < this.$o.length; i++) {
        notify(this.$o[i], STATE_DIRTY);
      }
    }
  }
  return this.$v;
}
var ScopeNode = function Scope() {
  this[SCOPE] = null;
  this.$ns = null;
  this.$ps = null;
  if (currentScope)
    currentScope.append(this);
};
var ScopeProto = ScopeNode.prototype;
ScopeProto.$cx = defaultContext;
ScopeProto.$eh = null;
ScopeProto.$c = null;
ScopeProto.$d = null;
ScopeProto.append = function(scope) {
  scope[SCOPE] = this;
  scope.$ps = this;
  if (this.$ns)
    this.$ns.$ps = scope;
  scope.$ns = this.$ns;
  this.$ns = scope;
  scope.$cx = scope.$cx === defaultContext ? this.$cx : { ...this.$cx, ...scope.$cx };
  if (this.$eh) {
    scope.$eh = !scope.$eh ? this.$eh : [...scope.$eh, ...this.$eh];
  }
};
ScopeProto.dispose = function() {
  dispose.call(this);
};
function createScope() {
  return new ScopeNode();
}
var ComputeNode = function Computation(initialValue, compute2, options) {
  ScopeNode.call(this);
  this.$st = compute2 ? STATE_DIRTY : STATE_CLEAN;
  this.$i = false;
  this.$e = false;
  this.$s = null;
  this.$o = null;
  this.$v = initialValue;
  if (compute2)
    this.$c = compute2;
  if (options && options.dirty)
    this.$ch = options.dirty;
};
var ComputeProto = ComputeNode.prototype;
Object.setPrototypeOf(ComputeProto, ScopeProto);
ComputeProto.$ch = isNotEqual;
ComputeProto.call = read;
function createComputation(initialValue, compute2, options) {
  return new ComputeNode(initialValue, compute2, options);
}
function isNotEqual(a, b) {
  return a !== b;
}
function isFunction(value) {
  return typeof value === "function";
}
function updateCheck(node) {
  if (node.$st === STATE_CHECK) {
    for (let i = 0; i < node.$s.length; i++) {
      updateCheck(node.$s[i]);
      if (node.$st === STATE_DIRTY) {
        break;
      }
    }
  }
  if (node.$st === STATE_DIRTY)
    update(node);
  else
    node.$st = STATE_CLEAN;
}
function cleanup(node) {
  if (node.$ns && node.$ns[SCOPE] === node)
    dispose.call(node, false);
  if (node.$d)
    emptyDisposal(node);
  node.$eh = node[SCOPE] ? node[SCOPE].$eh : null;
}
function update(node) {
  let prevObservers = currentObservers, prevObserversIndex = currentObserversIndex;
  currentObservers = null;
  currentObserversIndex = 0;
  try {
    cleanup(node);
    const result = compute(node, node.$c, node);
    if (currentObservers) {
      if (node.$s)
        removeSourceObservers(node, currentObserversIndex);
      if (node.$s && currentObserversIndex > 0) {
        node.$s.length = currentObserversIndex + currentObservers.length;
        for (let i = 0; i < currentObservers.length; i++) {
          node.$s[currentObserversIndex + i] = currentObservers[i];
        }
      } else {
        node.$s = currentObservers;
      }
      let source;
      for (let i = currentObserversIndex; i < node.$s.length; i++) {
        source = node.$s[i];
        if (!source.$o)
          source.$o = [node];
        else
          source.$o.push(node);
      }
    } else if (node.$s && currentObserversIndex < node.$s.length) {
      removeSourceObservers(node, currentObserversIndex);
      node.$s.length = currentObserversIndex;
    }
    if (!node.$e && node.$i) {
      write.call(node, result);
    } else {
      node.$v = result;
      node.$i = true;
    }
  } catch (error) {
    handleError(node, error);
    if (node.$st === STATE_DIRTY) {
      cleanup(node);
      if (node.$s)
        removeSourceObservers(node, 0);
    }
    return;
  }
  currentObservers = prevObservers;
  currentObserversIndex = prevObserversIndex;
  node.$st = STATE_CLEAN;
}
function notify(node, state) {
  if (node.$st >= state)
    return;
  if (node.$e && node.$st === STATE_CLEAN) {
    effects.push(node);
    if (!scheduledEffects)
      flushEffects();
  }
  node.$st = state;
  if (node.$o) {
    for (let i = 0; i < node.$o.length; i++) {
      notify(node.$o[i], STATE_CHECK);
    }
  }
}
function removeSourceObservers(node, index) {
  let source, swap;
  for (let i = index; i < node.$s.length; i++) {
    source = node.$s[i];
    if (source.$o) {
      swap = source.$o.indexOf(node);
      source.$o[swap] = source.$o[source.$o.length - 1];
      source.$o.pop();
    }
  }
}

// node_modules/.pnpm/shittier-maverick-signals@5.11.2/node_modules/shittier-maverick-signals/dist/prod/signals.js
function signal(initialValue, options) {
  const node = createComputation(initialValue, null, options), signal2 = read.bind(node);
  signal2[SCOPE] = true;
  signal2.set = write.bind(node);
  return signal2;
}
function computed(compute2, options) {
  const node = createComputation(
    options?.initial,
    compute2,
    options
  ), signal2 = read.bind(node);
  signal2[SCOPE] = true;
  return signal2;
}
function effect(effect2, options) {
  const signal2 = createComputation(
    null,
    function runEffect() {
      let effectResult = effect2();
      isFunction(effectResult) && onDispose(effectResult);
      return null;
    },
    void 0
  );
  signal2.$e = true;
  update(signal2);
  return dispose.bind(signal2, true);
}

// node_modules/.pnpm/mutation-events@1.0.4/node_modules/mutation-events/src/mutation_events.js
(function() {
  if ("MutationEvent" in window) {
    return;
  }
  if (window.mutationEventsPolyfillInstalled) {
    return;
  }
  window.mutationEventsPolyfillInstalled = true;
  const mutationEvents = /* @__PURE__ */ new Set([
    "DOMCharacterDataModified",
    "DOMNodeInserted",
    "DOMNodeInsertedIntoDocument",
    "DOMNodeRemoved",
    "DOMNodeRemovedFromDocument",
    "DOMSubtreeModified"
  ]);
  const polyfillEventNameExtension = "Polyfilled";
  const baseEventObj = {
    attrChange: 0,
    bubbles: true,
    cancelable: false,
    newValue: "",
    prevValue: "",
    relatedNode: null
  };
  function dispatchMutationEvent(type, target, options, fakeTarget) {
    let newEvent = Object.assign({}, baseEventObj);
    if (options) {
      newEvent = Object.assign(newEvent, options);
    }
    const event = new Event(type + polyfillEventNameExtension, newEvent);
    event.attrChange = newEvent.attrChange;
    event.newValue = newEvent.newValue;
    event.prevValue = newEvent.prevValue;
    event.relatedNode = newEvent.relatedNode;
    if (fakeTarget) {
      Object.defineProperty(event, "target", { writable: false, value: fakeTarget });
    }
    target.dispatchEvent(event);
  }
  function walk(n, action) {
    const walker = document.createTreeWalker(n, NodeFilter.SHOW_ALL);
    do {
      action(walker.currentNode);
    } while (walker.nextNode());
  }
  const documentsToObservers = /* @__PURE__ */ new Map();
  const listeningNodes = /* @__PURE__ */ new Set();
  function handleMutations(mutations) {
    const subtreeModified = [];
    mutations.forEach(function(mutation) {
      const target = mutation.target;
      const type = mutation.type;
      if (type === "attributes") {
        if (mutation.oldValue === null || target.getAttribute(mutation.attributeName) === null) {
          dispatchMutationEvent("DOMSubtreeModified", target, { attributeName: mutation.attributeName });
        }
      } else if (type === "characterData") {
        dispatchMutationEvent("DOMCharacterDataModified", target, { prevValue: mutation.oldValue, newValue: target.textContent });
        subtreeModified.push(target);
      } else if (type === "childList") {
        mutation.removedNodes.forEach((n) => {
          subtreeModified.push(target);
          dispatchMutationEvent("DOMNodeRemoved", n);
          dispatchMutationEvent("DOMNodeRemoved", target, void 0, n);
          walk(n, (node) => dispatchMutationEvent("DOMNodeRemovedFromDocument", node, { bubbles: false }));
          dispatchMutationEvent("DOMNodeRemovedFromDocument", target, { bubbles: false }, n);
        });
        mutation.addedNodes.forEach((n) => {
          subtreeModified.push(target);
          dispatchMutationEvent("DOMNodeInserted", n);
          walk(n, (node) => dispatchMutationEvent("DOMNodeInsertedIntoDocument", node, { bubbles: false }));
        });
      }
    });
    for (let touchedNode of subtreeModified) {
      dispatchMutationEvent("DOMSubtreeModified", touchedNode);
    }
  }
  function getRootElement(el) {
    let rootNode = el.getRootNode();
    while (rootNode instanceof ShadowRoot) {
      rootNode = rootNode.host.getRootNode();
    }
    if (rootNode instanceof Document) {
      return rootNode.documentElement;
    }
    return rootNode;
  }
  const observerOptions = { subtree: true, childList: true, attributes: true, attributeOldValue: true, characterData: true, characterDataOldValue: true };
  function enableMutationEventPolyfill(target) {
    if (listeningNodes.has(target))
      return;
    listeningNodes.add(target);
    const rootElement = getRootElement(target);
    if (documentsToObservers.has(rootElement)) {
      documentsToObservers.get(rootElement).count++;
      return;
    }
    const observer = new MutationObserver(handleMutations);
    documentsToObservers.set(rootElement, { observer, count: 1 });
    observer.observe(rootElement, observerOptions);
  }
  function disableMutationEventPolyfill(target) {
    if (!listeningNodes.has(target))
      return;
    listeningNodes.delete(target);
    const rootElement = getRootElement(target);
    if (!documentsToObservers.has(rootElement))
      return;
    if (--documentsToObservers.get(rootElement).count === 0) {
      const observer = documentsToObservers.get(rootElement).observer;
      documentsToObservers.delete(rootElement);
      observer.disconnect();
    }
  }
  const originalAddEventListener = Element.prototype.addEventListener;
  function getAugmentedListener(eventName, listener, options) {
    if (mutationEvents.has(eventName)) {
      return {
        fullEventName: eventName + polyfillEventNameExtension,
        augmentedListener: (event) => {
          Object.defineProperty(event, "type", { writable: false, value: eventName });
          listener(event);
        }
      };
    }
    return { fullEventName: eventName, augmentedListener: listener };
  }
  Element.prototype.addEventListener = function(eventName, listener, options) {
    if (mutationEvents.has(eventName)) {
      enableMutationEventPolyfill(this);
      const { augmentedListener, fullEventName } = getAugmentedListener(...arguments);
      originalAddEventListener.apply(this, [fullEventName, augmentedListener, options]);
      return;
    }
    originalAddEventListener.apply(this, arguments);
  };
  const originalRemoveEventListener = window.removeEventListener;
  Element.prototype.removeEventListener = function(eventName, listener, options) {
    if (mutationEvents.has(eventName)) {
      disableMutationEventPolyfill(this);
      const { augmentedListener, fullEventName } = getAugmentedListener(...arguments);
      originalRemoveEventListener.apply(this, [fullEventName, augmentedListener, options]);
      return;
    }
    originalRemoveEventListener.apply(this, arguments);
  };
  console.log("Mutation Events polyfill installed.");
})();

// src/picori.js
var primitives = {
  /*
        This Signal API works with every popular style of doing signal APIs.
  
        Vue:
        const count = ref(0);
        count.value = count.value + 1;
  
        SolidJS:
        const [count, setCount] = ref(0);
        setCount(count() + 1);
        setCount(c => c + 1);
  
        Voby:
        const count = ref(0);
        count(count() + 1);
        count(c => c + 1);
  
        Getters / setters:
        const count = ref(0);
        count.set(count.get() + 1);
      */
  $: (v) => {
    const val = signal(v);
    const setOrCb = (newVal) => typeof newVal == "function" ? val.set(newVal(val())) : val.set(newVal);
    const ret = (...args) => {
      if (args.length == 0)
        return val();
      setOrCb(args[0]);
    };
    Object.defineProperty(ret, "value", {
      get: val,
      set: (newVal) => val.set(newVal)
    });
    ret[Symbol.iterator] = function* () {
      yield val;
      yield setOrCb;
    };
    ret[Symbol.toPrimitive] = val;
    return ret;
  },
  computed,
  effect,
  onDispose
};
var picoriGlobal = "__PICORI_DATA_DO_NOT_TOUCH_OR_YOU_WILL_BE_FIRED__";
var attributesToObject = (attributes) => Object.fromEntries(
  Array.from(attributes).reduce((p, c) => [...p, [c.name, c.value]], [])
);
async function runSetupScript(script, props = {}) {
  let __vite__injectQuery = (e) => "data:text/javascript;base64," + btoa(
    atob(e.split("data:text/javascript;base64,")[1]) + "/*" + Math.random() + "*/"
  );
  window[picoriGlobal].currentProps = props;
  const ret = await import(
    /* @vite-ignore */
    "data:text/javascript;base64," + btoa(
      "let {" + Object.keys(window[picoriGlobal].primitives).join() + "}=window['" + picoriGlobal + "'].primitives;let{" + Object.keys(props).join() + "}=window['" + picoriGlobal + "'].currentProps;" + script + "/*" + Math.random() + Math.random() + Math.random() + "*/"
    )
  );
  window[picoriGlobal].currentProps = {};
  return ret;
}
var evalWithObject = (str, obj) => (0, eval)(`(({${Object.keys(obj).join()}}) => ${str})`)(obj);
function replacePropertyReactively(node, prop, exports) {
  node.style.display = "contents";
  const expr = node.getAttribute(":");
  node.addEventListener(
    "DOMNodeRemovedFromDocument",
    effect(() => {
      let ret = evalWithObject(expr, exports);
      if (typeof ret == "function")
        ret = ret();
      node[prop] = ret;
    })
  );
}
var pTags = {
  "P-IF": async (node, exports) => {
    const conditionalCode = node.getAttribute(":");
    debugger;
    let i = 0;
    for (const slot of node.getElementsByTagName("slot")) {
      const nodes = slot.assignedNodes();
      if (!nodes.length)
        continue;
      const root2 = document.createElement("div");
      root2.style.display = "contents";
      root2.id = `psroot-${i++}`;
      root2.attachShadow({ mode: "open" });
      const sourceRoot = nodes[0].getRootNode();
      root2.shadowRoot.adoptedStyleSheets = [...sourceRoot.styleSheets, ...sourceRoot.adoptedStyleSheets];
      root2.shadowRoot.append(...nodes);
      slot.replaceWith(root2);
    }
    const template = node.cloneNode(true);
    node.innerHTML = "";
    node.addEventListener(
      "DOMNodeRemovedFromDocument",
      await effect(async () => {
        let conditionMet = evalWithObject(conditionalCode, exports);
        if (conditionMet) {
          node.innerHTML = template.innerHTML;
          for (const child of node.children) {
            if (!child.id.startsWith("psroot-"))
              continue;
            const orig = template.querySelector("#" + child.id);
            child.attachShadow({ mode: "open" });
            child.shadowRoot.adoptedStyleSheets = orig.shadowRoot.adoptedStyleSheets;
            child.shadowRoot.append(...orig.shadowRoot.childNodes.map((c) => c.cloneNode(true)));
          }
          await processNodes([...node.children], exports);
        } else {
          node.innerHTML = "";
        }
      })
    );
    return true;
  },
  "P-HTML": (node, exports) => replacePropertyReactively(node, "innerHTML", exports),
  "P-TEXT": (node, exports) => replacePropertyReactively(node, "textContent", exports),
  "P-SHOW": async (node, exports) => {
    const expr = node.getAttribute(":");
    node.addEventListener(
      "DOMNodeRemovedFromDocument",
      await effect(() => {
        let ret = evalWithObject(expr, exports);
        if (typeof ret == "function")
          ret = ret();
        node.style.display = ret ? "contents" : "none";
      })
    );
  },
  "P-FOR": async (node, exports) => {
    node.style.display = "contents";
    const iterableCode = node.getAttribute(":each");
    const name = node.getAttribute("as");
    const template = node.cloneNode(true);
    node.addEventListener(
      "DOMNodeRemovedFromDocument",
      await effect(async () => {
        const iterable = evalWithObject(iterableCode, exports);
        const newNodes = [];
        for (const i of iterable) {
          const builtTemplate = template.cloneNode(true);
          newNodes.push(...builtTemplate.childNodes);
          await processNodes([...builtTemplate.children], {
            ...exports,
            [name]: i
          });
        }
        node.innerHTML = "";
        for (const elem of newNodes)
          node.appendChild(elem);
      })
    );
    return true;
  }
};
async function processNodes(nodes, exports) {
  for (const elem of nodes) {
    if (pTags?.[elem.tagName]) {
      if (await pTags[elem.tagName](elem, exports))
        continue;
    } else {
      for (const attr of elem.attributes) {
        if (attr.name[0] == "@") {
          elem.addEventListener(attr.name.slice(1), (event) => {
            let resp = evalWithObject(attr.value, exports);
            if (typeof resp == "function")
              resp(event);
          });
        } else if (attr.name[0] == ":" && !elem.isPicoriElement) {
          const boundAttribute = attr.name.slice(1);
          effect(() => {
            let ret = evalWithObject(attr.value, exports);
            if (typeof ret == "function")
              ret = ret();
            boundAttribute == "value" ? elem.value = ret : elem.setAttribute(boundAttribute, ret);
          });
        }
      }
    }
    nodes.push(...elem.children);
    if (elem.isPicoriElement) {
      const props = attributesToObject(elem.attributes);
      for (const [name, val] of Object.entries(props)) {
        if (name[0] == ":") {
          elem.props[name.slice(1)] = evalWithObject(val, exports);
          delete elem.expressionProps[name];
        } else {
          elem.props[name] = val;
        }
      }
      for (const [name, expression] of Object.entries(elem.expressionProps))
        elem.props[name.slice(1)] = evalWithObject(expression, primitives);
      await elem.setup();
    }
  }
}
window[picoriGlobal] = { primitives };
var components = document.querySelectorAll("head > template[name]");
var picoElements = [];
for (const comp of components) {
  const name = comp.getAttribute("name");
  const defaultProps = attributesToObject(comp.attributes);
  delete defaultProps["name"];
  const picoriElement = class extends HTMLElement {
    constructor() {
      super();
      this.isPicoriElement = true;
      this.template = comp.content.cloneNode(true);
      for (const elem of this.template.children) {
        if (elem.tagName != "SCRIPT")
          continue;
        this.setupScript = elem.innerHTML;
        elem.remove();
        break;
      }
      if (!this.setupScript)
        this.setupScript = "";
      this.props = {};
      this.expressionProps = {};
      for (const [name2, prop] of Object.entries(defaultProps)) {
        name2[0] == ":" ? this.expressionProps[name2] = prop : this.props[name2] = prop;
      }
      if (this.shadowRoot)
        return;
      this.attachShadow({ mode: "open" }).appendChild(this.template);
      this.shadowRoot.adoptedStyleSheets = document.adoptedStyleSheets;
    }
    async setup() {
      await root(async (dispose2) => {
        this.dispose = dispose2;
        const exports = await runSetupScript(this.setupScript, this.props);
        const elems = [...this.template.children, ...this.shadowRoot.children];
        await processNodes(elems, exports);
      });
    }
    disconnectedCallback() {
      this.dispose?.();
    }
  };
  customElements.define(name, picoriElement);
  picoElements.push(name);
}
(async () => {
  await processNodes([
    ...document.querySelectorAll(
      picoElements.map((t) => `${t}:not(${picoElements.map((p) => `${p} ${t}`).join()})`).join()
    )
  ]);
})();
