import { content } from "./test.ts";

enum Test {
  ONE = 1,
}

console.log(content + Test.ONE);

setTimeout(() => {
  import("./lazy.ts").then((res) => {
    console.log("res", res.default);
  });
}, 2000);
