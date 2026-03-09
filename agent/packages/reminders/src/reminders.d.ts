export interface CreateReminderInput {
    name: string;
    body?: string;
    priority?: number;
    dueDate?: Date;
    list?: string;
}
export interface Reminder {
    name: string;
    body: string;
    dueDate: string;
}
export declare function createReminder(input: CreateReminderInput): Promise<void>;
export declare function getOpenReminders(list?: string): Promise<Reminder[]>;
export declare function searchReminders(query: string, list?: string): Promise<Reminder[]>;
export declare function completeReminder(name: string, list?: string): Promise<void>;
