import {
  signal,
  computed,
  effect,
  onDispose,
  root,
} from "shittier-maverick-signals";
import "mutation-events";

const primitives = {
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

    const setOrCb = (newVal) =>
      typeof newVal == "function" ? val.set(newVal(val())) : val.set(newVal);

    const ret = (...args) => {
      if (args.length == 0) return val();

      setOrCb(args[0]);
    };

    Object.defineProperty(ret, "value", {
      get: val,
      set: (newVal) => val.set(newVal),
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
  onDispose,
};

const picoriGlobal = "__PICORI_DATA_DO_NOT_TOUCH_OR_YOU_WILL_BE_FIRED__";

const attributesToObject = (attributes) =>
  Object.fromEntries(
    Array.from(attributes).reduce((p, c) => [...p, [c.name, c.value]], [])
  );

async function runSetupScript(script, props = {}) {
  // FUCK OFF VITE. THIS ISN'T YOUR FUCKING JOB.
  let __vite__injectQuery = (e) =>
    "data:text/javascript;base64," +
    btoa(
      atob(e.split("data:text/javascript;base64,")[1]) +
        "/*" +
        Math.random() +
        "*/"
    );

  window[picoriGlobal].currentProps = props;

  const ret = await import(
    /* @vite-ignore */
    "data:text/javascript;base64," +
      btoa(
        "let {" +
          Object.keys(window[picoriGlobal].primitives).join() +
          "}=window['" +
          picoriGlobal +
          "'].primitives;let{" +
          Object.keys(props).join() +
          "}=window['" +
          picoriGlobal +
          "'].currentProps;" +
          script +
          "/*" +
          Math.random() +
          Math.random() +
          Math.random() +
          "*/"
      )
  );

  window[picoriGlobal].currentProps = {};

  return ret;
}

const evalWithObject = (str, obj) =>
  (0, eval)(`(({${Object.keys(obj).join()}}) => ${str})`)(obj);

async function replacePropertyReactively(node, prop, exports) {
  node.style.display = "contents";
  const expr = node.getAttribute(":");

  node.addEventListener(
    "DOMNodeRemovedFromDocument",
    await effect(() => {
      let ret = evalWithObject(expr, exports);
      if (typeof ret == "function") ret = ret();
      node[prop] = ret;
    })
  );
}

const pTags = {
  "P-IF": async (node, exports) => {
    const conditionalCode = node.getAttribute(":");

    for (const slot of node.getElementsByTagName("slot"))
      slot.replaceWith(...slot.assignedNodes());

    const template = node.cloneNode(true);
    node.innerHTML = "";

    node.addEventListener(
      "DOMNodeRemovedFromDocument",
      await effect(async () => {
        let conditionMet = evalWithObject(conditionalCode, exports);

        if (conditionMet) {
          node.innerHTML = template.innerHTML;

          await processNodes([...node.children], exports);
        } else {
          node.innerHTML = "";
        }
      })
    );

    return true;
  },
  "P-HTML": (node, exports) =>
    replacePropertyReactively(node, "innerHTML", exports),
  "P-TEXT": (node, exports) =>
    replacePropertyReactively(node, "textContent", exports),
  "P-SHOW": async (node, exports) => {
    const expr = node.getAttribute(":");

    node.addEventListener(
      "DOMNodeRemovedFromDocument",
      await effect(() => {
        let ret = evalWithObject(expr, exports);
        if (typeof ret == "function") ret = ret();

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
            [name]: i,
          });
        }

        node.innerHTML = "";
        for (const elem of newNodes) node.appendChild(elem);
      })
    );

    return true;
  },
};

async function processNodes(nodes, exports) {
  for (const elem of nodes) {
    if (pTags?.[elem.tagName]) {
      if (await pTags[elem.tagName](elem, exports)) continue;
    } else {
      for (const attr of elem.attributes) {
        if (attr.name[0] == "@") {
          elem.addEventListener(attr.name.slice(1), (event) => {
            let resp = evalWithObject(attr.value, exports);

            if (typeof resp == "function") resp(event);
          });
        } else if (attr.name[0] == ":" && !elem.isPicoriElement) {
          const boundAttribute = attr.name.slice(1);

          await effect(() => {
            let ret = evalWithObject(attr.value, exports);
            if (typeof ret == "function") ret = ret();

            boundAttribute == "value"
              ? (elem.value = ret)
              : elem.setAttribute(boundAttribute, ret);
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

const components = document.querySelectorAll("head > template[name]");

const picoElements = [];
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
        if (elem.tagName != "SCRIPT") continue;

        this.setupScript = elem.innerHTML;

        elem.remove();
        break;
      }

      if (!this.setupScript) this.setupScript = "";

      this.props = {};
      this.expressionProps = {};

      for (const [name, prop] of Object.entries(defaultProps)) {
        name[0] == ":"
          ? (this.expressionProps[name] = prop)
          : (this.props[name] = prop);
      }

      if (this.shadowRoot) return;
      this.attachShadow({ mode: "open" }).appendChild(this.template);
      this.shadowRoot.adoptedStyleSheets = document.adoptedStyleSheets;
    }

    async setup() {
      await root(async (dispose) => {
        this.dispose = dispose;

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

await processNodes([
  ...document.querySelectorAll(
    picoElements
      .map((t) => `${t}:not(${picoElements.map((p) => `${p} ${t}`).join()})`)
      .join()
  ),
]);
