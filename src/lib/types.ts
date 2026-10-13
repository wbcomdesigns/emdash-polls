export const POLLS = "polls";
export const VOTES = "votes";

export const QUESTION_MAX = 200;
export const THANKS_MAX = 140;
export const OPTIONS_MIN = 2;
export const OPTIONS_MAX = 10;

export type PollWho = "members" | "anyone";
export type PollResults = "always" | "after_vote" | "after_close";
export type PollStatus = "draft" | "open" | "closed";
export type PollAttach = "none" | "entry" | "collection" | "site";
export type PollPosition = "above" | "below";
export type PollNumbers = "full" | "percent";

export type PollOption = {
	id: string;
	label: string;
};

export type Poll = {
	question: string;
	options: PollOption[];
	multiple: boolean;
	allow_change: boolean;
	results: PollResults;
	status: PollStatus;
	closes_at: string;
	thanks: string;
	opens_at: string;
	position: PollPosition;
	numbers: PollNumbers;
	createdAt: string;
	who: PollWho;
	named: boolean;
	attach: PollAttach;
	attach_key: string;
	/** Write token for admin decisions. Not shown on screens. */
	rev: string;
};

export type Vote = {
	poll: string;
	poll_option: string;
	member_id: string;
	createdAt: string;
	visitor: string;
	member_name: string;
};

export const WHO: PollWho[] = ["members", "anyone"];
export const RESULTS: PollResults[] = ["always", "after_vote", "after_close"];
export const STATUSES: PollStatus[] = ["draft", "open", "closed"];
export const ATTACH: PollAttach[] = ["none", "entry", "collection", "site"];
export const POSITIONS: PollPosition[] = ["above", "below"];
export const NUMBERS: PollNumbers[] = ["full", "percent"];
