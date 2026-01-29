import { describe, it, expect } from "vitest";
import {
  extractVariables,
  substituteVariables,
} from "../../lib/dm-templates";

describe("DMTemplates", () => {
  describe("extractVariables", () => {
    it("should extract variables from template body", () => {
      const vars = extractVariables(
        "Hey {username}, welcome! My name is {fullname}.",
      );
      expect(vars).toContain("username");
      expect(vars).toContain("fullname");
      expect(vars).toHaveLength(2);
    });

    it("should handle no variables", () => {
      const vars = extractVariables("Hello, welcome to my page!");
      expect(vars).toHaveLength(0);
    });

    it("should deduplicate repeated variables", () => {
      const vars = extractVariables("{username} said hi to {username}");
      expect(vars).toHaveLength(1);
      expect(vars[0]).toBe("username");
    });

    it("should handle multiple different variables", () => {
      const vars = extractVariables("{a} {b} {c} {d}");
      expect(vars).toHaveLength(4);
    });
  });

  describe("substituteVariables", () => {
    it("should replace variables with values", () => {
      const result = substituteVariables(
        "Hey {username}, I'm {fullname}!",
        { username: "johndoe", fullname: "Jane Smith" },
      );
      expect(result).toBe("Hey johndoe, I'm Jane Smith!");
    });

    it("should leave unmatched variables intact", () => {
      const result = substituteVariables(
        "Hey {username}, you have {count} posts",
        { username: "johndoe" },
      );
      expect(result).toBe("Hey johndoe, you have {count} posts");
    });

    it("should handle empty values", () => {
      const result = substituteVariables("{username}", { username: "" });
      expect(result).toBe("");
    });

    it("should handle body with no variables", () => {
      const result = substituteVariables("Hello world!", { username: "test" });
      expect(result).toBe("Hello world!");
    });
  });
});
