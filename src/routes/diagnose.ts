// The tool-calling loop

import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { env } from "../config/env.js";
import { listPods, getPodLogs, describePod, queryLoki } from "../tools/k8s.js";

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
const MAX_TURNS = 5;

const tools = [
  {
    functionDeclarations: [
      {
        name: "listPods",
        description:
          "List all pods in the app namespace with their status. Use this first to see what's healthy and what isn't.",
        parameters: { type: SchemaType.OBJECT, properties: {} },
      },
      {
        name: "getPodLogs",
        description: "Get recent log lines from a specific pod.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            podName: {
              type: SchemaType.STRING,
              description: "Exact pod name from listPods",
            },
            lines: {
              type: SchemaType.NUMBER,
              description: "Number of recent lines, default 50",
            },
          },
          required: ["podName"],
        },
      },
      {
        name: "describePod",
        description:
          "Get full Kubernetes describe output including Events. Use when a pod never became Ready.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            podName: {
              type: SchemaType.STRING,
              description: "Exact pod name from listPods",
            },
          },
          required: ["podName"],
        },
      },
      {
        name: "queryLoki",
        description:
          "Search aggregated logs with a LogQL query across pods/time.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            logqlQuery: {
              type: SchemaType.STRING,
              description: "A valid LogQL query string",
            },
          },
          required: ["logqlQuery"],
        },
      },
    ],
  },
];

const toolImplementations: Record<string, (args: any) => Promise<string>> = {
  listPods: () => listPods(),
  getPodLogs: (args) => getPodLogs(args.podName, args.lines),
  describePod: (args) => describePod(args.podName),
  queryLoki: (args) => queryLoki(args.logqlQuery),
};

export async function diagnose(question: string): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite",
    tools,
    systemInstruction:
      "You are a Kubernetes diagnostic assistant for the DocuMind app. " +
      "You have read-only tools to inspect pods and logs - you cannot " +
      "modify or restart anything. Investigate using the available tools, " +
      "then give a clear, concise diagnosis in plain English.",
  });

  const chat = model.startChat();
  let result = await chat.sendMessage(question);

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const calls = result.response.functionCalls();
    if (!calls || calls.length === 0) {
      return result.response.text();
    }

    const responses = await Promise.all(
      calls.map(async (call) => {
        const impl = toolImplementations[call.name];
        if (!impl) {
          return {
            functionResponse: {
              name: call.name,
              response: { error: `Unknown tool: ${call.name}` },
            },
          };
        }
        try {
          const output = await impl(call.args);
          return {
            functionResponse: { name: call.name, response: { output } },
          };
        } catch (err) {
          return {
            functionResponse: {
              name: call.name,
              response: {
                error: err instanceof Error ? err.message : String(err),
              },
            },
          };
        }
      }),
    );

    result = await chat.sendMessage(responses);
  }

  return "Reached the maximum number of investigation steps without a conclusive answer.";
}
