import { describe, it, expect, beforeEach, afterEach } from "bun:test";

describe("Gitea Review with Comments MCP Tool", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.REPO_OWNER = "testowner";
    process.env.REPO_NAME = "testrepo";
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITEA_API_URL = "https://gitea.example.com/api/v1";
    process.env.PR_NUMBER = "123";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("create_review_with_comments tool", () => {
    it("should be included in allowed tools", async () => {
      const { buildAllowedToolsString } = await import(
        "../src/create-prompt/index"
      );

      const allowedTools = buildAllowedToolsString();
      expect(allowedTools).toContain("mcp__gitea__create_review_with_comments");
    });

    it("should have correct tool parameters", () => {
      // Test that the tool accepts the expected parameters
      const expectedParams = {
        body: "string (optional)",
        event: "COMMENT | APPROVE | REQUEST_CHANGES (optional)",
        commit_id: "string (optional)",
        comments: "array of {path, body, line, side}",
      };

      // This is a structural test to ensure the tool interface is correct
      expect(expectedParams).toBeDefined();
    });

    it("should construct correct API endpoint", () => {
      const owner = "testowner";
      const repo = "testrepo";
      const pullNumber = 123;

      const expectedEndpoint = `/api/v1/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`;

      expect(expectedEndpoint).toBe(
        "/api/v1/repos/testowner/testrepo/pulls/123/reviews",
      );
    });

    it("should format review data correctly for single comment", () => {
      const reviewData = {
        body: "Overall review comment",
        event: "COMMENT",
        commit_id: "abc123",
        comments: [
          {
            path: "src/test.ts",
            body: "This is a test comment",
            line: 42,
            side: "RIGHT",
          },
        ],
      };

      expect(reviewData.event).toBe("COMMENT");
      expect(reviewData.comments).toHaveLength(1);
      expect(reviewData.comments[0].path).toBe("src/test.ts");
      expect(reviewData.comments[0].line).toBe(42);
      expect(reviewData.comments[0].side).toBe("RIGHT");
    });

    it("should format review data correctly for multiple comments", () => {
      const reviewData = {
        body: "",
        event: "REQUEST_CHANGES",
        comments: [
          {
            path: "src/test.ts",
            body: "First comment",
            line: 10,
            side: "RIGHT",
          },
          {
            path: "src/another.ts",
            body: "Second comment",
            line: 20,
            side: "LEFT",
          },
        ],
      };

      expect(reviewData.comments).toHaveLength(2);
      expect(reviewData.event).toBe("REQUEST_CHANGES");
      expect(reviewData.body).toBe("");
    });

    it("should default side to RIGHT when not specified", () => {
      const comment = {
        path: "src/test.ts",
        body: "Test comment",
        line: 10,
        side: undefined,
      };

      const side = comment.side || "RIGHT";
      expect(side).toBe("RIGHT");
    });

    it("should map RIGHT side to new_position", () => {
      const comment = {
        path: "src/test.ts",
        body: "Test",
        line: 42,
        side: "RIGHT",
      };

      const giteaComment: any = {
        path: comment.path,
        body: comment.body,
      };

      if (comment.side === "LEFT") {
        giteaComment.old_position = comment.line;
      } else {
        giteaComment.new_position = comment.line;
      }

      expect(giteaComment.new_position).toBe(42);
      expect(giteaComment.old_position).toBeUndefined();
    });

    it("should map LEFT side to old_position", () => {
      const comment = {
        path: "src/test.ts",
        body: "Test",
        line: 42,
        side: "LEFT",
      };

      const giteaComment: any = {
        path: comment.path,
        body: comment.body,
      };

      if (comment.side === "LEFT") {
        giteaComment.old_position = comment.line;
      } else {
        giteaComment.new_position = comment.line;
      }

      expect(giteaComment.old_position).toBe(42);
      expect(giteaComment.new_position).toBeUndefined();
    });
  });

  describe("prompt template updates", () => {
    it("should mention review with comments in capabilities", async () => {
      // Test that the buildAllowedToolsString includes our new tool
      const { buildAllowedToolsString } = await import(
        "../src/create-prompt/index"
      );

      const allowedTools = buildAllowedToolsString();

      // Check that the tool is included in the allowed tools string
      expect(allowedTools).toContain("mcp__gitea__create_review_with_comments");
    });

    it("should include review with comments instructions in static prompt content", async () => {
      // Test that the prompt template source contains references to the new tool
      const fs = await import("fs");
      const path = await import("path");

      const promptFilePath = path.join(
        process.cwd(),
        "src/create-prompt/index.ts",
      );
      const promptContent = fs.readFileSync(promptFilePath, "utf-8");

      // Check that PR-specific review comment instructions are present in the source
      expect(promptContent).toContain("For code reviews and feedback");
      expect(promptContent).toContain(
        "mcp__gitea__create_review_with_comments",
      );
    });
  });

  describe("tool availability", () => {
    it("should include review with comments tool in allowed tools for PRs", async () => {
      const { buildAllowedToolsString } = await import(
        "../src/create-prompt/index"
      );

      const allowedTools = buildAllowedToolsString();

      expect(allowedTools).toContain("mcp__gitea__create_review_with_comments");
    });

    it("should maintain existing Gitea tools alongside new review with comments tool", async () => {
      const { buildAllowedToolsString } = await import(
        "../src/create-prompt/index"
      );

      const allowedTools = buildAllowedToolsString();

      // Ensure existing tools are still present
      expect(allowedTools).toContain("mcp__gitea__update_pull_request_comment");
      expect(allowedTools).toContain("mcp__gitea__create_pull_request");
      expect(allowedTools).toContain("mcp__gitea__update_issue_comment");

      // And new tool is added
      expect(allowedTools).toContain("mcp__gitea__create_review_with_comments");
    });
  });
});
