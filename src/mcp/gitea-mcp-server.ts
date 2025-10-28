#!/usr/bin/env node
// Gitea API Operations MCP Server
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fetch from "node-fetch";

// Get configuration from environment variables
const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;
const BRANCH_NAME = process.env.BRANCH_NAME;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITEA_API_URL = process.env.GITEA_API_URL || "https://api.github.com";

console.log(`[GITEA-MCP] Starting Gitea API Operations MCP Server`);
console.log(`[GITEA-MCP] REPO_OWNER: ${REPO_OWNER}`);
console.log(`[GITEA-MCP] REPO_NAME: ${REPO_NAME}`);
console.log(`[GITEA-MCP] BRANCH_NAME: ${BRANCH_NAME}`);
console.log(`[GITEA-MCP] GITEA_API_URL: ${GITEA_API_URL}`);
console.log(`[GITEA-MCP] GITHUB_TOKEN: ${GITHUB_TOKEN ? "***" : "undefined"}`);

if (!REPO_OWNER || !REPO_NAME || !GITHUB_TOKEN) {
  console.error(
    "[GITEA-MCP] Error: REPO_OWNER, REPO_NAME, and GITHUB_TOKEN environment variables are required",
  );
  process.exit(1);
}

const server = new McpServer({
  name: "Gitea API Operations Server",
  version: "0.0.1",
});

// Helper function to make authenticated requests to Gitea API
async function giteaRequest(
  endpoint: string,
  method: string = "GET",
  body?: any,
): Promise<any> {
  const url = `${GITEA_API_URL}${endpoint}`;
  console.log(`[GITEA-MCP] Making ${method} request to: ${url}`);

  const headers: Record<string, string> = {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: "application/json",
  };

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const responseText = await response.text();
  console.log(`[GITEA-MCP] Response status: ${response.status}`);
  console.log(`[GITEA-MCP] Response: ${responseText.substring(0, 500)}...`);

  if (!response.ok) {
    throw new Error(
      `Gitea API request failed: ${response.status} ${responseText}`,
    );
  }

  return responseText ? JSON.parse(responseText) : null;
}

// Get issue details
server.tool(
  "get_issue",
  "Get details of a specific issue",
  {
    issue_number: z.number().describe("The issue number to fetch"),
  },
  async ({ issue_number }) => {
    try {
      const issue = await giteaRequest(
        `/api/v1/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issue_number}`,
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(issue, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error getting issue: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error getting issue: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// Get issue comments
server.tool(
  "get_issue_comments",
  "Get all comments for a specific issue",
  {
    issue_number: z.number().describe("The issue number to fetch comments for"),
    since: z
      .string()
      .optional()
      .describe("Only show comments updated after this time (ISO 8601 format)"),
    before: z
      .string()
      .optional()
      .describe(
        "Only show comments updated before this time (ISO 8601 format)",
      ),
  },
  async ({ issue_number, since, before }) => {
    try {
      let endpoint = `/api/v1/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issue_number}/comments`;
      const params = new URLSearchParams();

      if (since) params.append("since", since);
      if (before) params.append("before", before);

      if (params.toString()) {
        endpoint += `?${params.toString()}`;
      }

      const comments = await giteaRequest(endpoint);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(comments, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[GITEA-MCP] Error getting issue comments: ${errorMessage}`,
      );
      return {
        content: [
          {
            type: "text",
            text: `Error getting issue comments: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// Add a comment to an issue
server.tool(
  "add_issue_comment",
  "Add a new comment to an issue",
  {
    issue_number: z.number().describe("The issue number to comment on"),
    body: z.string().describe("The comment body content"),
  },
  async ({ issue_number, body }) => {
    try {
      const comment = await giteaRequest(
        `/api/v1/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issue_number}/comments`,
        "POST",
        { body },
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(comment, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error adding issue comment: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error adding issue comment: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// Update (edit) an issue comment
server.tool(
  "update_issue_comment",
  "Update an existing issue comment",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    commentId: z.number().describe("The comment ID to update"),
    body: z.string().describe("The new comment body content"),
  },
  async ({ owner, repo, commentId, body }) => {
    try {
      const comment = await giteaRequest(
        `/api/v1/repos/${owner}/${repo}/issues/comments/${commentId}`,
        "PATCH",
        { body },
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(comment, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[GITEA-MCP] Error updating issue comment: ${errorMessage}`,
      );
      return {
        content: [
          {
            type: "text",
            text: `Error updating issue comment: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// Delete an issue comment
server.tool(
  "delete_issue_comment",
  "Delete an issue comment",
  {
    comment_id: z.number().describe("The comment ID to delete"),
  },
  async ({ comment_id }) => {
    try {
      await giteaRequest(
        `/api/v1/repos/${REPO_OWNER}/${REPO_NAME}/issues/comments/${comment_id}`,
        "DELETE",
      );

      return {
        content: [
          {
            type: "text",
            text: `Successfully deleted comment ${comment_id}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[GITEA-MCP] Error deleting issue comment: ${errorMessage}`,
      );
      return {
        content: [
          {
            type: "text",
            text: `Error deleting issue comment: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// Get a specific comment
server.tool(
  "get_comment",
  "Get details of a specific comment",
  {
    comment_id: z.number().describe("The comment ID to fetch"),
  },
  async ({ comment_id }) => {
    try {
      const comment = await giteaRequest(
        `/api/v1/repos/${REPO_OWNER}/${REPO_NAME}/issues/comments/${comment_id}`,
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(comment, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error getting comment: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error getting comment: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// List issues
server.tool(
  "list_issues",
  "List issues in the repository",
  {
    state: z
      .enum(["open", "closed", "all"])
      .optional()
      .describe("Issue state filter"),
    labels: z
      .string()
      .optional()
      .describe("Comma-separated list of label names"),
    milestone: z.string().optional().describe("Milestone title to filter by"),
    assignee: z
      .string()
      .optional()
      .describe("Username to filter issues assigned to"),
    creator: z
      .string()
      .optional()
      .describe("Username to filter issues created by"),
    mentioned: z
      .string()
      .optional()
      .describe("Username to filter issues that mention"),
    page: z.number().optional().describe("Page number for pagination"),
    limit: z.number().optional().describe("Number of items per page"),
  },
  async ({
    state,
    labels,
    milestone,
    assignee,
    creator,
    mentioned,
    page,
    limit,
  }) => {
    try {
      let endpoint = `/api/v1/repos/${REPO_OWNER}/${REPO_NAME}/issues`;
      const params = new URLSearchParams();

      if (state) params.append("state", state);
      if (labels) params.append("labels", labels);
      if (milestone) params.append("milestone", milestone);
      if (assignee) params.append("assignee", assignee);
      if (creator) params.append("creator", creator);
      if (mentioned) params.append("mentioned", mentioned);
      if (page) params.append("page", page.toString());
      if (limit) params.append("limit", limit.toString());

      if (params.toString()) {
        endpoint += `?${params.toString()}`;
      }

      const issues = await giteaRequest(endpoint);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(issues, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error listing issues: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error listing issues: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// Create an issue
server.tool(
  "create_issue",
  "Create a new issue",
  {
    title: z.string().describe("Issue title"),
    body: z.string().optional().describe("Issue body content"),
    assignee: z.string().optional().describe("Username to assign the issue to"),
    assignees: z
      .array(z.string())
      .optional()
      .describe("Array of usernames to assign the issue to"),
    milestone: z
      .number()
      .optional()
      .describe("Milestone ID to associate with the issue"),
    labels: z
      .array(z.string())
      .optional()
      .describe("Array of label names to apply to the issue"),
  },
  async ({ title, body, assignee, assignees, milestone, labels }) => {
    try {
      const issueData: any = { title };

      if (body) issueData.body = body;
      if (assignee) issueData.assignee = assignee;
      if (assignees) issueData.assignees = assignees;
      if (milestone) issueData.milestone = milestone;
      if (labels) issueData.labels = labels;

      const issue = await giteaRequest(
        `/api/v1/repos/${REPO_OWNER}/${REPO_NAME}/issues`,
        "POST",
        issueData,
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(issue, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error creating issue: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error creating issue: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// Update an issue
server.tool(
  "update_issue",
  "Update an existing issue",
  {
    issue_number: z.number().describe("The issue number to update"),
    title: z.string().optional().describe("New issue title"),
    body: z.string().optional().describe("New issue body content"),
    assignee: z.string().optional().describe("Username to assign the issue to"),
    assignees: z
      .array(z.string())
      .optional()
      .describe("Array of usernames to assign the issue to"),
    milestone: z
      .number()
      .optional()
      .describe("Milestone ID to associate with the issue"),
    labels: z
      .array(z.string())
      .optional()
      .describe("Array of label names to apply to the issue"),
    state: z.enum(["open", "closed"]).optional().describe("Issue state"),
  },
  async ({
    issue_number,
    title,
    body,
    assignee,
    assignees,
    milestone,
    labels,
    state,
  }) => {
    try {
      const updateData: any = {};

      if (title) updateData.title = title;
      if (body !== undefined) updateData.body = body;
      if (assignee) updateData.assignee = assignee;
      if (assignees) updateData.assignees = assignees;
      if (milestone) updateData.milestone = milestone;
      if (labels) updateData.labels = labels;
      if (state) updateData.state = state;

      const issue = await giteaRequest(
        `/api/v1/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issue_number}`,
        "PATCH",
        updateData,
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(issue, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error updating issue: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error updating issue: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// Get repository information
server.tool("get_repository", "Get repository information", {}, async () => {
  try {
    const repo = await giteaRequest(`/api/v1/repos/${REPO_OWNER}/${REPO_NAME}`);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(repo, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[GITEA-MCP] Error getting repository: ${errorMessage}`);
    return {
      content: [
        {
          type: "text",
          text: `Error getting repository: ${errorMessage}`,
        },
      ],
      error: errorMessage,
      isError: true,
    };
  }
});

// Get pull requests
server.tool(
  "list_pull_requests",
  "List pull requests in the repository",
  {
    state: z
      .enum(["open", "closed", "all"])
      .optional()
      .describe("Pull request state filter"),
    head: z.string().optional().describe("Head branch name"),
    base: z.string().optional().describe("Base branch name"),
    page: z.number().optional().describe("Page number for pagination"),
    limit: z.number().optional().describe("Number of items per page"),
  },
  async ({ state, head, base, page, limit }) => {
    try {
      let endpoint = `/api/v1/repos/${REPO_OWNER}/${REPO_NAME}/pulls`;
      const params = new URLSearchParams();

      if (state) params.append("state", state);
      if (head) params.append("head", head);
      if (base) params.append("base", base);
      if (page) params.append("page", page.toString());
      if (limit) params.append("limit", limit.toString());

      if (params.toString()) {
        endpoint += `?${params.toString()}`;
      }

      const pulls = await giteaRequest(endpoint);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(pulls, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error listing pull requests: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error listing pull requests: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// Get a specific pull request
server.tool(
  "get_pull_request",
  "Get details of a specific pull request",
  {
    pull_number: z.number().describe("The pull request number to fetch"),
  },
  async ({ pull_number }) => {
    try {
      const pull = await giteaRequest(
        `/api/v1/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${pull_number}`,
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(pull, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error getting pull request: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error getting pull request: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// Create a pull request
server.tool(
  "create_pull_request",
  "Create a new pull request",
  {
    title: z.string().describe("Pull request title"),
    body: z.string().optional().describe("Pull request body/description"),
    head: z.string().describe("Head branch name"),
    base: z.string().describe("Base branch name"),
    assignee: z
      .string()
      .optional()
      .describe("Username to assign the pull request to"),
    assignees: z
      .array(z.string())
      .optional()
      .describe("Array of usernames to assign the pull request to"),
    milestone: z
      .number()
      .optional()
      .describe("Milestone ID to associate with the pull request"),
    labels: z
      .array(z.string())
      .optional()
      .describe("Array of label names to apply to the pull request"),
  },
  async ({
    title,
    body,
    head,
    base,
    assignee,
    assignees,
    milestone,
    labels,
  }) => {
    try {
      const pullData: any = { title, head, base };

      if (body) pullData.body = body;
      if (assignee) pullData.assignee = assignee;
      if (assignees) pullData.assignees = assignees;
      if (milestone) pullData.milestone = milestone;
      if (labels) pullData.labels = labels;

      const pull = await giteaRequest(
        `/api/v1/repos/${REPO_OWNER}/${REPO_NAME}/pulls`,
        "POST",
        pullData,
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(pull, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error creating pull request: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error creating pull request: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// Update a pull request
server.tool(
  "update_pull_request",
  "Update an existing pull request",
  {
    pull_number: z.number().describe("The pull request number to update"),
    title: z.string().optional().describe("New pull request title"),
    body: z.string().optional().describe("New pull request body/description"),
    base: z.string().optional().describe("New base branch name"),
    assignee: z
      .string()
      .optional()
      .describe("Username to assign the pull request to"),
    assignees: z
      .array(z.string())
      .optional()
      .describe("Array of usernames to assign the pull request to"),
    milestone: z
      .number()
      .optional()
      .describe("Milestone ID to associate with the pull request"),
    labels: z
      .array(z.string())
      .optional()
      .describe("Array of label names to apply to the pull request"),
    state: z.enum(["open", "closed"]).optional().describe("Pull request state"),
    allow_maintainer_edit: z
      .boolean()
      .optional()
      .describe("Allow maintainer edits"),
  },
  async ({
    pull_number,
    title,
    body,
    base,
    assignee,
    assignees,
    milestone,
    labels,
    state,
    allow_maintainer_edit,
  }) => {
    try {
      const updateData: any = {};

      if (title) updateData.title = title;
      if (body !== undefined) updateData.body = body;
      if (base) updateData.base = base;
      if (assignee) updateData.assignee = assignee;
      if (assignees) updateData.assignees = assignees;
      if (milestone) updateData.milestone = milestone;
      if (labels) updateData.labels = labels;
      if (state) updateData.state = state;
      if (allow_maintainer_edit !== undefined)
        updateData.allow_maintainer_edit = allow_maintainer_edit;

      const pull = await giteaRequest(
        `/api/v1/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${pull_number}`,
        "PATCH",
        updateData,
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(pull, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error updating pull request: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error updating pull request: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// Merge a pull request
server.tool(
  "merge_pull_request",
  "Merge a pull request",
  {
    pull_number: z.number().describe("The pull request number to merge"),
    merge_method: z
      .enum([
        "merge",
        "rebase",
        "rebase-merge",
        "squash",
        "fast-forward-only",
        "manually-merged",
      ])
      .optional()
      .default("merge")
      .describe("Merge strategy to use"),
    merge_commit_id: z
      .string()
      .optional()
      .describe("Specific commit ID to merge"),
    merge_message: z
      .string()
      .optional()
      .describe("Custom merge commit message"),
    merge_title: z.string().optional().describe("Custom merge commit title"),
  },
  async ({
    pull_number,
    merge_method = "merge",
    merge_commit_id,
    merge_message,
    merge_title,
  }) => {
    try {
      const mergeData: any = { Do: merge_method };

      if (merge_commit_id) mergeData.MergeCommitID = merge_commit_id;
      if (merge_message) mergeData.MergeMessageField = merge_message;
      if (merge_title) mergeData.MergeTitleField = merge_title;

      const result = await giteaRequest(
        `/api/v1/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${pull_number}/merge`,
        "POST",
        mergeData,
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error merging pull request: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error merging pull request: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// Update pull request branch
server.tool(
  "update_pull_request_branch",
  "Update a pull request branch to latest base",
  {
    pull_number: z.number().describe("The pull request number to update"),
    style: z
      .enum(["merge", "rebase"])
      .optional()
      .default("merge")
      .describe("How to update the pull request branch"),
  },
  async ({ pull_number, style = "merge" }) => {
    try {
      let endpoint = `/api/v1/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${pull_number}/update`;
      if (style) {
        endpoint += `?style=${style}`;
      }

      await giteaRequest(endpoint, "POST");

      return {
        content: [
          {
            type: "text",
            text: `Successfully updated pull request ${pull_number} branch using ${style} strategy`,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[GITEA-MCP] Error updating pull request branch: ${errorMessage}`,
      );
      return {
        content: [
          {
            type: "text",
            text: `Error updating pull request branch: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// Check if pull request is merged
server.tool(
  "check_pull_request_merged",
  "Check if a pull request is merged",
  {
    pull_number: z.number().describe("The pull request number to check"),
  },
  async ({ pull_number }) => {
    try {
      await giteaRequest(
        `/api/v1/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${pull_number}/merge`,
        "GET",
      );

      return {
        content: [
          {
            type: "text",
            text: `Pull request ${pull_number} is merged`,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("404")) {
        return {
          content: [
            {
              type: "text",
              text: `Pull request ${pull_number} is not merged`,
            },
          ],
        };
      }
      console.error(
        `[GITEA-MCP] Error checking pull request merge status: ${errorMessage}`,
      );
      return {
        content: [
          {
            type: "text",
            text: `Error checking pull request merge status: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// Set the active branch of an issue
server.tool(
  "set_issue_branch",
  "Set the active branch reference for an issue",
  {
    issue_number: z.number().describe("The issue number to update"),
    branch: z
      .string()
      .describe("The branch name to set as active for this issue"),
  },
  async ({ issue_number, branch }) => {
    try {
      const updateData = { ref: branch };

      const issue = await giteaRequest(
        `/api/v1/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issue_number}`,
        "PATCH",
        updateData,
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(issue, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error setting issue branch: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error setting issue branch: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// List repository branches
server.tool(
  "list_branches",
  "List all branches in the repository",
  {
    page: z.number().optional().describe("Page number for pagination"),
    limit: z.number().optional().describe("Number of items per page"),
  },
  async ({ page, limit }) => {
    try {
      let endpoint = `/api/v1/repos/${REPO_OWNER}/${REPO_NAME}/branches`;
      const params = new URLSearchParams();

      if (page) params.append("page", page.toString());
      if (limit) params.append("limit", limit.toString());

      if (params.toString()) {
        endpoint += `?${params.toString()}`;
      }

      const branches = await giteaRequest(endpoint);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(branches, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error listing branches: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error listing branches: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// Get a specific branch
server.tool(
  "get_branch",
  "Get details of a specific branch",
  {
    branch_name: z.string().describe("The branch name to fetch"),
  },
  async ({ branch_name }) => {
    try {
      const branch = await giteaRequest(
        `/api/v1/repos/${REPO_OWNER}/${REPO_NAME}/branches/${encodeURIComponent(branch_name)}`,
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(branch, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error getting branch: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error getting branch: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// Update pull request comment
server.tool(
  "update_pull_request_comment",
  "Update a pull request review comment",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    commentId: z.number().describe("The comment ID to update"),
    body: z.string().describe("The new comment body content"),
  },
  async ({ owner, repo, commentId, body }) => {
    try {
      const comment = await giteaRequest(
        `/api/v1/repos/${owner}/${repo}/pulls/comments/${commentId}`,
        "PATCH",
        { body },
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(comment, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[GITEA-MCP] Error updating pull request comment: ${errorMessage}`,
      );
      return {
        content: [
          {
            type: "text",
            text: `Error updating pull request comment: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// Delete a file from repository
server.tool(
  "delete_file",
  "Delete a file from the repository",
  {
    owner: z.string().describe("Repository owner"),
    repo: z.string().describe("Repository name"),
    filepath: z.string().describe("Path to the file to delete"),
    message: z.string().describe("Commit message for the deletion"),
    branch: z
      .string()
      .optional()
      .describe("Branch to delete from (defaults to default branch)"),
    sha: z.string().describe("SHA of the file to delete"),
  },
  async ({ owner, repo, filepath, message, branch, sha }) => {
    try {
      const deleteData: any = {
        message,
        sha,
      };

      if (branch) {
        deleteData.branch = branch;
      }

      const result = await giteaRequest(
        `/api/v1/repos/${owner}/${repo}/contents/${encodeURIComponent(filepath)}`,
        "DELETE",
        deleteData,
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error deleting file: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error deleting file: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// Create a pull request review with inline comments
server.tool(
  "create_review_with_comments",
  "Create a pull request review with multiple inline comments on specific lines in PR files. This creates ONE review (one PR comment) that can contain multiple inline file comments underneath it.",
  {
    body: z
      .string()
      .optional()
      .describe(
        "Overall review comment text (optional, can be empty if only posting inline comments)",
      ),
    event: z
      .enum(["COMMENT", "APPROVE", "REQUEST_CHANGES"])
      .optional()
      .default("COMMENT")
      .describe(
        "Review event type: COMMENT (general feedback), APPROVE (approve PR), or REQUEST_CHANGES (request changes)",
      ),
    commit_id: z
      .string()
      .optional()
      .describe(
        "Specific commit SHA to review (defaults to latest commit in PR)",
      ),
    comments: z
      .array(
        z.object({
          path: z
            .string()
            .describe("The file path to comment on (e.g., 'src/index.js')"),
          body: z
            .string()
            .describe(
              "The comment text (supports markdown). For code suggestions, you can reference specific code sections.",
            ),
          line: z
            .number()
            .positive()
            .describe(
              "The line number to comment on (1-based line number in the file)",
            ),
          side: z
            .enum(["LEFT", "RIGHT"])
            .optional()
            .default("RIGHT")
            .describe(
              "Side of the diff: LEFT (old code, before changes) or RIGHT (new code, after changes)",
            ),
        }),
      )
      .min(1)
      .describe(
        "Array of inline comments to include in this review. Each comment references a specific line in a file.",
      ),
  },
  async ({ body, event = "COMMENT", commit_id, comments }) => {
    try {
      // Get PR number from environment
      const prNumber = process.env.PR_NUMBER;
      if (!prNumber) {
        throw new Error(
          "PR_NUMBER environment variable is required for creating reviews",
        );
      }

      // Get commit SHA if not provided
      let commitSha = commit_id;
      if (!commitSha) {
        const pr = await giteaRequest(
          `/api/v1/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${prNumber}`,
        );
        commitSha = pr.head.sha;
      }

      // Transform comments to Gitea API format
      // Gitea uses old_position for LEFT side and new_position for RIGHT side
      const giteaComments = comments.map((comment) => {
        const giteaComment: any = {
          path: comment.path,
          body: comment.body,
        };

        // Map side to old_position or new_position
        if (comment.side === "LEFT") {
          giteaComment.old_position = comment.line;
        } else {
          // RIGHT is default
          giteaComment.new_position = comment.line;
        }

        return giteaComment;
      });

      // Create the review with inline comments
      const review = await giteaRequest(
        `/api/v1/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${prNumber}/reviews`,
        "POST",
        {
          body: body || "", // Empty body is allowed
          event: event,
          commit_id: commitSha,
          comments: giteaComments,
        },
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                review_id: review.id,
                comments_count: comments.length,
                event: event,
                message: `Review created successfully with ${comments.length} inline comment${comments.length > 1 ? "s" : ""} on PR #${prNumber}`,
                files_commented: [...new Set(comments.map((c) => c.path))],
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Provide more helpful error messages for common issues
      let helpMessage = "";
      if (errorMessage.includes("Validation Failed")) {
        helpMessage =
          "\n\nThis usually means:\n" +
          "- A line number doesn't exist in the diff or is out of range\n" +
          "- A file path is incorrect or not part of the PR changes\n" +
          "- You're trying to comment on lines that aren't modified in the PR\n" +
          "Make sure all line numbers reference lines that are part of the PR's changes.";
      } else if (errorMessage.includes("Not Found") || errorMessage.includes("404")) {
        helpMessage =
          "\n\nThis usually means the PR number, repository, or commit SHA is incorrect.";
      }

      console.error(
        `[GITEA-MCP] Error creating review with comments: ${errorMessage}`,
      );
      return {
        content: [
          {
            type: "text",
            text: `Error creating review with comments: ${errorMessage}${helpMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// List all reviews for a pull request
server.tool(
  "list_pull_reviews",
  "Get all reviews for a pull request. Returns an array of review objects including review IDs, authors, states (APPROVED/REQUEST_CHANGES/COMMENT), bodies, and comment counts. Use this to check existing reviews before creating a new one to avoid duplicating feedback.",
  {
    pr_number: z
      .number()
      .optional()
      .describe(
        "Pull request number (optional, defaults to PR_NUMBER environment variable)",
      ),
  },
  async ({ pr_number }) => {
    try {
      const prNumber =
        pr_number || (process.env.PR_NUMBER ? parseInt(process.env.PR_NUMBER) : null);

      if (!prNumber) {
        throw new Error(
          "PR_NUMBER environment variable is required for listing reviews",
        );
      }

      const reviews = await giteaRequest(
        `/api/v1/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${prNumber}/reviews`,
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                pr_number: prNumber,
                reviews_count: reviews.length,
                reviews: reviews.map((review: any) => ({
                  id: review.id,
                  user: review.user?.login || review.user?.username,
                  state: review.state,
                  body: review.body,
                  commit_id: review.commit_id,
                  submitted_at: review.submitted_at,
                  comments_count: review.comments?.length || 0,
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error listing PR reviews: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error listing PR reviews: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// Get details of a specific review
server.tool(
  "get_pull_review",
  "Get detailed information about a specific review including its metadata and associated comments. Use this after list_pull_reviews to get full details of a particular review.",
  {
    review_id: z.number().describe("The ID of the review to fetch"),
    pr_number: z
      .number()
      .optional()
      .describe(
        "Pull request number (optional, defaults to PR_NUMBER environment variable)",
      ),
  },
  async ({ review_id, pr_number }) => {
    try {
      const prNumber =
        pr_number || (process.env.PR_NUMBER ? parseInt(process.env.PR_NUMBER) : null);

      if (!prNumber) {
        throw new Error(
          "PR_NUMBER environment variable is required for getting review",
        );
      }

      const review = await giteaRequest(
        `/api/v1/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${prNumber}/reviews/${review_id}`,
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(review, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[GITEA-MCP] Error getting PR review: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Error getting PR review: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

// List all inline comments from a specific review
server.tool(
  "list_review_comments",
  "Get all inline comments from a specific review. Returns detailed information about each comment including file path, line number, body text, diff hunk, and the code side (old/new). Use this to check what was already commented on in previous reviews to avoid duplicates.",
  {
    review_id: z.number().describe("The ID of the review to get comments from"),
    pr_number: z
      .number()
      .optional()
      .describe(
        "Pull request number (optional, defaults to PR_NUMBER environment variable)",
      ),
  },
  async ({ review_id, pr_number }) => {
    try {
      const prNumber =
        pr_number || (process.env.PR_NUMBER ? parseInt(process.env.PR_NUMBER) : null);

      if (!prNumber) {
        throw new Error(
          "PR_NUMBER environment variable is required for listing review comments",
        );
      }

      const comments = await giteaRequest(
        `/api/v1/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${prNumber}/reviews/${review_id}/comments`,
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                review_id: review_id,
                pr_number: prNumber,
                comments_count: comments.length,
                comments: comments.map((comment: any) => ({
                  id: comment.id,
                  path: comment.path,
                  line: comment.line || comment.new_position || comment.old_position,
                  side: comment.old_position ? "LEFT" : "RIGHT",
                  body: comment.body,
                  diff_hunk: comment.diff_hunk,
                  created_at: comment.created_at,
                  updated_at: comment.updated_at,
                  user: comment.user?.login || comment.user?.username,
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[GITEA-MCP] Error listing review comments: ${errorMessage}`,
      );
      return {
        content: [
          {
            type: "text",
            text: `Error listing review comments: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

async function runServer() {
  console.log(`[GITEA-MCP] Starting MCP server transport...`);
  const transport = new StdioServerTransport();
  console.log(`[GITEA-MCP] Connecting to transport...`);
  await server.connect(transport);
  console.log(`[GITEA-MCP] Gitea MCP server connected and ready!`);
  process.on("exit", () => {
    console.log(`[GITEA-MCP] Server shutting down...`);
    server.close();
  });
}

console.log(`[GITEA-MCP] Calling runServer()...`);
runServer().catch((error) => {
  console.error(`[GITEA-MCP] Server startup failed:`, error);
  process.exit(1);
});
