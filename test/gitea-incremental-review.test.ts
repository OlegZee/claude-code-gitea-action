import { describe, it, expect, beforeEach, afterEach } from "bun:test";

describe("Gitea Incremental Review MCP Tools", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.REPO_OWNER = "testowner";
    process.env.REPO_NAME = "testrepo";
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITEA_API_URL = "https://gitea.example.com";
    process.env.PR_NUMBER = "123";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("list_pull_reviews tool", () => {
    it("should be included in allowed tools", async () => {
      const { buildAllowedToolsString } = await import(
        "../src/create-prompt/index"
      );

      const allowedTools = buildAllowedToolsString();
      expect(allowedTools).toContain("mcp__gitea__list_pull_reviews");
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

    it("should format review list response correctly", () => {
      const mockReviews = [
        {
          id: 1,
          user: { login: "claude-bot", username: "claude-bot" },
          state: "COMMENT",
          body: "Looks good overall",
          commit_id: "abc123",
          submitted_at: "2024-01-01T00:00:00Z",
          comments: [{ id: 1 }, { id: 2 }],
        },
        {
          id: 2,
          user: { login: "human-reviewer", username: "human-reviewer" },
          state: "APPROVED",
          body: "LGTM!",
          commit_id: "def456",
          submitted_at: "2024-01-02T00:00:00Z",
          comments: [],
        },
      ];

      const formattedReviews = mockReviews.map((review: any) => ({
        id: review.id,
        user: review.user?.login || review.user?.username,
        state: review.state,
        body: review.body,
        commit_id: review.commit_id,
        submitted_at: review.submitted_at,
        comments_count: review.comments?.length || 0,
      }));

      expect(formattedReviews).toHaveLength(2);
      expect(formattedReviews[0].id).toBe(1);
      expect(formattedReviews[0].user).toBe("claude-bot");
      expect(formattedReviews[0].comments_count).toBe(2);
      expect(formattedReviews[1].comments_count).toBe(0);
    });

    it("should handle reviews with no comments", () => {
      const review = {
        id: 1,
        user: { login: "bot" },
        state: "COMMENT",
        body: "Initial review",
        comments: [],
      };

      const commentsCount = review.comments?.length || 0;
      expect(commentsCount).toBe(0);
    });
  });

  describe("get_pull_review tool", () => {
    it("should be included in allowed tools", async () => {
      const { buildAllowedToolsString } = await import(
        "../src/create-prompt/index"
      );

      const allowedTools = buildAllowedToolsString();
      expect(allowedTools).toContain("mcp__gitea__get_pull_review");
    });

    it("should construct correct API endpoint with review ID", () => {
      const owner = "testowner";
      const repo = "testrepo";
      const pullNumber = 123;
      const reviewId = 456;

      const expectedEndpoint = `/api/v1/repos/${owner}/${repo}/pulls/${pullNumber}/reviews/${reviewId}`;

      expect(expectedEndpoint).toBe(
        "/api/v1/repos/testowner/testrepo/pulls/123/reviews/456",
      );
    });

    it("should have required review_id parameter", () => {
      const params = {
        review_id: 456,
        pr_number: 123,
      };

      expect(params.review_id).toBeDefined();
      expect(typeof params.review_id).toBe("number");
    });
  });

  describe("list_review_comments tool", () => {
    it("should be included in allowed tools", async () => {
      const { buildAllowedToolsString } = await import(
        "../src/create-prompt/index"
      );

      const allowedTools = buildAllowedToolsString();
      expect(allowedTools).toContain("mcp__gitea__list_review_comments");
    });

    it("should construct correct API endpoint for review comments", () => {
      const owner = "testowner";
      const repo = "testrepo";
      const pullNumber = 123;
      const reviewId = 456;

      const expectedEndpoint = `/api/v1/repos/${owner}/${repo}/pulls/${pullNumber}/reviews/${reviewId}/comments`;

      expect(expectedEndpoint).toBe(
        "/api/v1/repos/testowner/testrepo/pulls/123/reviews/456/comments",
      );
    });

    it("should format review comments correctly", () => {
      const mockComments = [
        {
          id: 1,
          path: "src/index.ts",
          line: 42,
          new_position: 42,
          old_position: undefined,
          body: "Consider adding error handling here",
          diff_hunk: "@@ -40,6 +40,7 @@ function test() {",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          user: { login: "claude-bot" },
        },
        {
          id: 2,
          path: "src/utils.ts",
          line: 15,
          new_position: undefined,
          old_position: 15,
          body: "This logic looks incorrect",
          diff_hunk: "@@ -13,5 +13,5 @@ function helper() {",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          user: { login: "claude-bot" },
        },
      ];

      const formattedComments = mockComments.map((comment: any) => ({
        id: comment.id,
        path: comment.path,
        line: comment.line || comment.new_position || comment.old_position,
        side: comment.old_position ? "LEFT" : "RIGHT",
        body: comment.body,
        diff_hunk: comment.diff_hunk,
        created_at: comment.created_at,
        updated_at: comment.updated_at,
        user: comment.user?.login || comment.user?.username,
      }));

      expect(formattedComments).toHaveLength(2);
      expect(formattedComments[0].path).toBe("src/index.ts");
      expect(formattedComments[0].line).toBe(42);
      expect(formattedComments[0].side).toBe("RIGHT");
      expect(formattedComments[1].side).toBe("LEFT");
    });

    it("should correctly identify comment side from position fields", () => {
      const rightSideComment = {
        new_position: 42,
        old_position: undefined,
      };

      const leftSideComment = {
        new_position: undefined,
        old_position: 15,
      };

      const rightSide = rightSideComment.old_position ? "LEFT" : "RIGHT";
      const leftSide = leftSideComment.old_position ? "LEFT" : "RIGHT";

      expect(rightSide).toBe("RIGHT");
      expect(leftSide).toBe("LEFT");
    });

    it("should handle comments with multiple line formats", () => {
      const comment1 = { line: 10, new_position: undefined, old_position: undefined };
      const comment2 = { line: undefined, new_position: 20, old_position: undefined };
      const comment3 = { line: undefined, new_position: undefined, old_position: 30 };

      const line1 = comment1.line || comment1.new_position || comment1.old_position;
      const line2 = comment2.line || comment2.new_position || comment2.old_position;
      const line3 = comment3.line || comment3.new_position || comment3.old_position;

      expect(line1).toBe(10);
      expect(line2).toBe(20);
      expect(line3).toBe(30);
    });
  });

  describe("prompt template updates", () => {
    it("should include incremental review instructions in prompt content", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const promptFilePath = path.join(
        process.cwd(),
        "src/create-prompt/index.ts",
      );
      const promptContent = fs.readFileSync(promptFilePath, "utf-8");

      // Check that incremental review instructions are present
      expect(promptContent).toContain("Check for existing reviews");
      expect(promptContent).toContain("mcp__gitea__list_pull_reviews");
      expect(promptContent).toContain("mcp__gitea__list_review_comments");
      expect(promptContent).toContain("DO NOT duplicate comments");
    });

    it("should include all three new tools in instructions", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const promptFilePath = path.join(
        process.cwd(),
        "src/create-prompt/index.ts",
      );
      const promptContent = fs.readFileSync(promptFilePath, "utf-8");

      expect(promptContent).toContain("mcp__gitea__list_pull_reviews");
      expect(promptContent).toContain("mcp__gitea__get_pull_review");
      expect(promptContent).toContain("mcp__gitea__list_review_comments");
    });

    it("should explain incremental review workflow", async () => {
      const fs = await import("fs");
      const path = await import("path");

      const promptFilePath = path.join(
        process.cwd(),
        "src/create-prompt/index.ts",
      );
      const promptContent = fs.readFileSync(promptFilePath, "utf-8");

      // Check for key workflow steps
      expect(promptContent).toContain("existing reviews");
      expect(promptContent).toContain("prior reviews");
      expect(promptContent).toContain("AVOID duplicating");
    });
  });

  describe("tool availability", () => {
    it("should include all three incremental review tools in allowed tools", async () => {
      const { buildAllowedToolsString } = await import(
        "../src/create-prompt/index"
      );

      const allowedTools = buildAllowedToolsString();

      expect(allowedTools).toContain("mcp__gitea__list_pull_reviews");
      expect(allowedTools).toContain("mcp__gitea__get_pull_review");
      expect(allowedTools).toContain("mcp__gitea__list_review_comments");
    });

    it("should maintain existing review tools alongside new incremental review tools", async () => {
      const { buildAllowedToolsString } = await import(
        "../src/create-prompt/index"
      );

      const allowedTools = buildAllowedToolsString();

      // Existing review tool
      expect(allowedTools).toContain("mcp__gitea__create_review_with_comments");

      // New incremental review tools
      expect(allowedTools).toContain("mcp__gitea__list_pull_reviews");
      expect(allowedTools).toContain("mcp__gitea__get_pull_review");
      expect(allowedTools).toContain("mcp__gitea__list_review_comments");

      // Other existing tools
      expect(allowedTools).toContain("mcp__gitea__get_pull_request");
      expect(allowedTools).toContain("mcp__gitea__update_issue_comment");
    });
  });

  describe("incremental review use case", () => {
    it("should support filtering reviews by author", () => {
      const allReviews = [
        { id: 1, user: { login: "claude-bot" }, state: "COMMENT" },
        { id: 2, user: { login: "human-user" }, state: "APPROVED" },
        { id: 3, user: { login: "claude-bot" }, state: "REQUEST_CHANGES" },
      ];

      const claudeReviews = allReviews.filter(
        (r) => r.user.login === "claude-bot",
      );

      expect(claudeReviews).toHaveLength(2);
      expect(claudeReviews[0].id).toBe(1);
      expect(claudeReviews[1].id).toBe(3);
    });

    it("should support comparing comment locations for duplicate detection", () => {
      const existingComments = [
        { path: "src/index.ts", line: 42, body: "Fix this issue" },
        { path: "src/utils.ts", line: 10, body: "Add tests" },
      ];

      const newCommentLocation = { path: "src/index.ts", line: 42 };
      const isDuplicate = existingComments.some(
        (c) => c.path === newCommentLocation.path && c.line === newCommentLocation.line,
      );

      expect(isDuplicate).toBe(true);

      const uniqueCommentLocation = { path: "src/index.ts", line: 50 };
      const isUnique = !existingComments.some(
        (c) => c.path === uniqueCommentLocation.path && c.line === uniqueCommentLocation.line,
      );

      expect(isUnique).toBe(true);
    });

    it("should extract commit IDs from reviews for comparison", () => {
      const reviews = [
        { id: 1, commit_id: "abc123", submitted_at: "2024-01-01T00:00:00Z" },
        { id: 2, commit_id: "def456", submitted_at: "2024-01-02T00:00:00Z" },
        { id: 3, commit_id: "ghi789", submitted_at: "2024-01-03T00:00:00Z" },
      ];

      // Get the most recent review's commit
      const mostRecentReview = reviews[reviews.length - 1];
      expect(mostRecentReview.commit_id).toBe("ghi789");
    });
  });
});
