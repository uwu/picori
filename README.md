# picori - small reactive components defined in your html
picori is a small frontend framework that allows you to define reactive components by using plain HTML tags, without a build step.

```html
<html>
  <head>
    <!-- Define a component -->
    <template name="my-component" prop="hi">
      <!-- This script runs whenever the component is mounted -->
      <script>
        console.log(prop) // The prop is accessible from the script!

        let boundHTML = prop + " world!"

        // Calling the expose function w/ an object will make that object accessible from the template
        expose ({ boundHTML })
      </script>

      <slot></slot>
      <!-- Template in data from a script -->
      <p-html :="boundHTML"></p-html>
    </template>

    <script type="module" src="https://esm.sh/picori"></script>
  </head>
  <body>
    <!-- You can use the component anywhere in your body now! -->
    <my-component>
      <!-- This gets templated into the <slot></slot> -->
      <h1>picori demo</h1>
    </my-component>
  </body>
</html>
```
