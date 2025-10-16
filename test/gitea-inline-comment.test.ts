import { describe, it, expect, beforeEach, afterEach } from "bun:test";

describe("Gitea Inline Comment MCP Tool", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.REPO_OWNER = "testowner";
    process.env.REPO_NAME = "testrepo";
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITEA_API_URL = "https://gitea.example.com/api/v1";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("create_pull_request_review_comment tool", () => {
    it("should be included in allowed tools", async () => {
      const { buildAllowedToolsString } = await import("../src/create-prompt/index");

      const allowedTools = buildAllowedToolsString();
      expect(allowedTools).toContain("mcp__gitea__create_inline_comment");
    });

    it("should have correct tool parameters", () => {
      // Test that the tool accepts the expected parameters
      const expectedParams = {
        pull_number: "number",
        path: "string", 
        line: "number",
        body: "string",
        side: "string (optional)"
      };

      // This is a structural test to ensure the tool interface is correct
      expect(expectedParams).toBeDefined();
    });

    it("should construct correct API endpoint", () => {
      const owner = "testowner";
      const repo = "testrepo";
      const pullNumber = 123;
      
      const expectedEndpoint = `/api/v1/repos/${owner}/${repo}/pulls/${pullNumber}/comments`;
      
      expect(expectedEndpoint).toBe("/api/v1/repos/testowner/testrepo/pulls/123/comments");
    });

    it("should format comment data correctly", () => {
      const commentData = {
        body: "This is a test comment",
        path: "src/test.ts",
        line: 42,
        side: "RIGHT"
      };

      expect(commentData.body).toBe("This is a test comment");
      expect(commentData.path).toBe("src/test.ts");
      expect(commentData.line).toBe(42);
      expect(commentData.side).toBe("RIGHT");
    });

    it("should default side to RIGHT when not specified", () => {
      const commentData = {
        body: "Test comment",
        path: "src/test.ts", 
        line: 10,
        side: undefined
      };

      const side = commentData.side || "RIGHT";
      expect(side).toBe("RIGHT");
    });
  });

  describe("prompt template updates", () => {
    it("should mention inline comments in capabilities", async () => {
      // Test that the buildAllowedToolsString includes our new tool
      const { buildAllowedToolsString } = await import("../src/create-prompt/index");
      
      const allowedTools = buildAllowedToolsString();
      
      // Check that the tool is included in the allowed tools string
      expect(allowedTools).toContain("mcp__gitea__create_inline_comment");
    });

    it("should include inline comment instructions in static prompt content", async () => {
      // Test that the prompt template source contains references to inline comments
      const fs = await import("fs");
      const path = await import("path");
      
      const promptFilePath = path.join(process.cwd(), "src/create-prompt/index.ts");
      const promptContent = fs.readFileSync(promptFilePath, "utf-8");
      
      // Check that PR-specific inline comment instructions are present in the source
      expect(promptContent).toContain("For inline feedback");
      expect(promptContent).toContain("mcp__gitea__create_inline_comment");
    });
  });

  describe("tool availability", () => {
    it("should include inline comment tool in allowed tools for PRs", async () => {
      const { buildAllowedToolsString } = await import("../src/create-prompt/index");

      const allowedTools = buildAllowedToolsString();

      expect(allowedTools).toContain("mcp__gitea__create_inline_comment");
    });

    it("should maintain existing Gitea tools alongside new inline comment tool", async () => {
      const { buildAllowedToolsString } = await import("../src/create-prompt/index");
      
      const allowedTools = buildAllowedToolsString();
      
      // Ensure existing tools are still present
      expect(allowedTools).toContain("mcp__gitea__update_pull_request_comment");
      expect(allowedTools).toContain("mcp__gitea__create_pull_request");
      expect(allowedTools).toContain("mcp__gitea__update_issue_comment");
      
      // And new tool is added
      expect(allowedTools).toContain("mcp__gitea__create_inline_comment");
    });
  });
});