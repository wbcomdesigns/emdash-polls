/** Every phrase a visitor can see. Edit this file to reword or translate the kit. */

export const polls = {
	loading: "Loading poll...",
	notFound: "This poll is not available.",
	notFoundHelp: "Check the poll on this page, or open a different one.",
	closed: "This poll is closed.",
	hidden: "Results will show after you vote.",
	hiddenClosed: "Results will show after the poll closes.",
	answers: "Answers",
	vote: "Vote",
	voted: "You voted.",
	change: "Change vote",
	busy: "Saving...",
	named: "Your choice will be visible to the site owner.",
	signIn: "Sign in to vote.",
	signInLink: "Sign in",
	signInVotes: "Sign in to see your votes.",
	myVotes: "My votes",
	myVotesHelp: "Polls you have voted in on this site.",
	myVotesEmpty: "You have not voted in any polls yet.",
	myVotesEmptyHelp: "Open a poll on this site and pick an answer.",
	erase: "Delete my votes",
	eraseArm: "Click again to delete them for good",
	eraseHelp: "This removes your votes from every poll on this site. Poll totals will drop.",
	erased: "Your votes were removed.",
	statusOpen: "Open",
	statusClosed: "Closed",
	statusDraft: "Draft",
	chose: (labels: string[]) =>
		labels.length === 1 ? `You chose ${labels[0]}.` : `You chose ${labels.join(", ")}.`,
	honeypot: "company website",
	total: (n: number) => (n === 1 ? "1 vote" : `${n} votes`),
	count: (n: number) => (n === 1 ? "1 vote" : `${n} votes`),
	percent: (n: number) => `${n}%`,
	offline: "Could not reach the site. Check your connection.",
	fallback: "Something went wrong. Try again.",
	notOpen: "This poll is not open.",
	invalid: "Pick an answer from the list.",
	already: "You have already voted.",
	membersOnly: "Sign in to vote in this poll.",
	rateLimited: "Too many requests. Try again in an hour.",
	spam: "That vote was not saved.",
	noVisitor: "This site cannot record a guest vote right now.",
};

const CODES: Record<string, string> = {
	NOT_FOUND: polls.notFound,
	NOT_OPEN: polls.notOpen,
	INVALID_CHOICE: polls.invalid,
	ALREADY_VOTED: polls.already,
	MEMBERS_ONLY: polls.membersOnly,
	SIGN_IN_REQUIRED: polls.signIn,
	RATE_LIMITED: polls.rateLimited,
	SPAM: polls.spam,
	NO_VISITOR: polls.noVisitor,
	OFFLINE: polls.offline,
	FAILED: polls.fallback,
};

export function phrase(code?: string): string {
	return CODES[code ?? ""] ?? polls.fallback;
}
