import type { EmailConfig } from "@hamid/email";

export const config: EmailConfig = {
  accounts: {
    // Configure after OAuth setup. Example:
    //
    // personal: {
    //   address: "sat@gmail.com",
    //   schedule: "0 9,18 * * *",
    //   allowDelete: true,
    //   rules: [
    //     { match: { from: "*@marketing.*" }, action: "trash" },
    //     { match: { from: "*@bank.*" }, action: "create_todo", priority: "high" },
    //   ],
    // },
  },
};
