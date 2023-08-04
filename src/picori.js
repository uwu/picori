import {
  signal,
  computed,
  effect,
  onDispose,
  root,
} from '@maverick-js/signals';

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
      typeof newVal == 'function' ? val.set(newVal(val())) : val.set(newVal);

    const ret = (...args) => {
      if (args.length == 0) return val();

      setOrCb(args[0]);
    };

    Object.defineProperty(ret, 'value', {
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

const attributesToObject = (attributes) =>
  Object.fromEntries(
    Array.from(attributes).reduce((p, c) => [...p, [c.name, c.value]], [])
  );

export function getFunctionBody(functionString) {
  const body = functionString.replace(/\((?<args>.*?)\)/s, '').trim();

  if (/^=>\s*?{/s.test(body) || body.startsWith('function')) {
    return body.replace(/^(?:=>|function)\s*?{(.+)}$/s, '$1');
  } else if (body.startsWith('=>')) {
    return `return (${body.slice(2)})`;
  }

  return null;
}

function withWith(scope, code) {
  return new Function(`with (arguments[0]) {${code}}`).bind(globalThis)(scope);
}

function getVariablesFromFunction(script, startingScope = {}) {
  const scope = {};

  withWith(
    new Proxy(startingScope, {
      has: () => true,
      get: (target, property) =>
        target[property] ??
        scope[property] ??
        globalThis[property]?.bind?.(globalThis) ??
        globalThis[property],
      set(_, property, newProperty) {
        scope[property] = newProperty;

        return true;
      },
    }),
    script
  );

  return scope;
}

const runSetupScript = (script, props = {}) => {
  try {
    return getVariablesFromFunction(script, { ...props, ...primitives });
  } catch (e) {
    console.error(e);
  }
};

const evalWithObject = (str, obj) => withWith(obj, 'return ' + str);

function replacePropertyReactively(node, prop, exports) {
  node.style.display = 'contents';
  const expr = node.getAttribute(':');

  effect(() => {
    let ret = evalWithObject(expr, exports);
    if (typeof ret == 'function') ret = ret();
    node[prop] = ret;
  });
}

const pTags = {
  'P-IF': (node, exports) => {
    const conditionalCode = node.getAttribute(':');

    for (const slot of node.getElementsByTagName('slot'))
      slot.replaceWith(...slot.assignedNodes());

    const template = node.cloneNode(true);

    let cleanup = () => {};
    effect(() => {
      let conditionMet = evalWithObject(conditionalCode, exports);

      if (conditionMet) {
        node.innerHTML = template.innerHTML;

        cleanup = processNodes([...node.children], exports);
      } else {
        node.innerHTML = '';
        cleanup();
      }
    });

    return true;
  },
  'P-HTML': (node, exports) =>
    replacePropertyReactively(node, 'innerHTML', exports),
  'P-TEXT': (node, exports) =>
    replacePropertyReactively(node, 'textContent', exports),
  'P-SHOW': (node, exports) => {
    const expr = node.getAttribute(':');
    effect(() => {
      let ret = evalWithObject(expr, exports);
      if (typeof ret == 'function') ret = ret();

      node.style.display = ret ? 'contents' : 'none';
    });
  },
  'P-FOR': (node, exports) => {
    node.style.display = 'contents';

    const iterableCode = node.getAttribute(':each');
    const name = node.getAttribute('as');

    const template = node.cloneNode(true);

    const cleanups = [];

    const eff = effect(() => {
      cleanups.forEach((c, i) => {
        c();
        cleanups.splice(i);
      });

      const iterable = evalWithObject(iterableCode, exports);

      const newNodes = [];

      for (const i of iterable) {
        const builtTemplate = template.cloneNode(true);
        newNodes.push(...builtTemplate.childNodes);

        cleanups.push(
          processNodes([...builtTemplate.children], {
            ...exports,
            [name]: i,
          })
        );
      }

      node.innerHTML = '';
      for (const elem of newNodes) node.appendChild(elem);
    });

    return true;
  },
};

function processNodes(nodes, exports) {
  let dispose;

  root((d) => {
    dispose = d;

    for (const elem of nodes) {
      if (pTags?.[elem.tagName]) {
        if (pTags[elem.tagName](elem, exports)) continue;
      } else {
        for (const attr of elem.attributes) {
          if (attr.name[0] == '@') {
            elem.addEventListener(attr.name.slice(1), (event) => {
              let resp = evalWithObject(attr.value, exports);

              if (typeof resp == 'function') resp(event);
            });
          } else if (attr.name[0] == ':' && !elem.isPicoriElement) {
            const boundAttribute = attr.name.slice(1);

            effect(() => {
              let ret = evalWithObject(attr.value, exports);
              if (typeof ret == 'function') ret = ret();

              boundAttribute == 'value'
                ? (elem.value = ret)
                : elem.setAttribute(boundAttribute, ret);
            });
          }
        }
      }

      // don't push slotted children
      nodes.push(...[...elem.children].filter((e) => !e.assignedSlot));

      if (!elem.isPicoriElement) continue;

      for (const [name, val] of Object.entries(
        attributesToObject(elem.attributes)
      )) {
        if (name[0] == '@') continue;

        if (name[0] == ':') {
          elem.props[name.slice(1)] = withWith('return ' + exports, val);
          delete elem.expressionProps[name];
        } else {
          elem.props[name] = val;
        }
      }

      for (const [name, expression] of Object.entries(elem.expressionProps))
        elem.props[name.slice(1)] = withWith(primitives, expression);

      elem.setup();
    }
  });

  return dispose;
}

const components = document.querySelectorAll('head > template[name]');

const picoElements = [];
for (const comp of components) {
  const name = comp.getAttribute('name');
  const defaultProps = attributesToObject(comp.attributes);
  delete defaultProps['name'];

  const picoriElement = class extends HTMLElement {
    constructor() {
      super();
      this.isPicoriElement = true;

      this.template = comp.content.cloneNode(true);
      for (const elem of this.template.children) {
        if (elem.tagName != 'SCRIPT') continue;

        this.setupScript = elem.innerHTML;

        elem.remove();
        break;
      }

      if (!this.setupScript) this.setupScript = '';

      this.props = {};
      this.expressionProps = {};

      for (const [name, prop] of Object.entries(defaultProps)) {
        name[0] == ':'
          ? (this.expressionProps[name] = prop)
          : (this.props[name] = prop);
      }

      if (this.shadowRoot) return;

      this.attachShadow({ mode: 'open' }).appendChild(this.template);

      if (window.__PICORI_SHEETS__)
        this.shadowRoot.adoptedStyleSheets = window.__PICORI_SHEETS__;
    }

    setup() {
      root((dispose) => {
        this.dispose = dispose;

        const exports = runSetupScript(this.setupScript, this.props);
        const elems = [...this.template.children, ...this.shadowRoot.children];
        processNodes(elems, exports);
      });
    }

    disconnectedCallback() {
      this.dispose?.();
    }
  };

  customElements.define(name, picoriElement);
  picoElements.push(name);
}

processNodes([
  ...document.querySelectorAll(
    picoElements
      .map((t) => `${t}:not(${picoElements.map((p) => `${p} ${t}`).join()})`)
      .join()
  ),
]);
