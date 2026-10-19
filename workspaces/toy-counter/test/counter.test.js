import assert from "node:assert/strict";
import { test } from "node:test";
import { add, multiply } from "../src/counter.js";

test("add returns the sum of two numbers", () => {
  assert.equal(add(2, 3), 5);
  assert.equal(add(-1, 1), 0);
});

test("multiply returns the product", () => {
  assert.equal(multiply(2, 4), 8);
});
