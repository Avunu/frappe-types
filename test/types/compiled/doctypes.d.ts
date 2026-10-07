// In a module, the registry is reached through `declare global`.
export {};

declare global {
	interface FrappeDocTypes {
		Project: {
			project_name: string;
			status: "Open" | "Completed" | "Cancelled";
			percent_complete: number;
		};
	}
}
