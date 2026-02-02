import { AppSidebar } from "../sidebar/app-sidebar";

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
	return <AppSidebar>{children}</AppSidebar>;
};
