import { Fragment, type ComponentType, type ReactNode } from "react";
import { View } from "react-native";

export function StaticList<T>({
	data,
	keyExtractor,
	renderItem,
	ItemSeparatorComponent: Separator,
	ListEmptyComponent,
}: {
	data: readonly T[];
	keyExtractor: (item: T) => string;
	renderItem: (info: { item: T; index: number }) => ReactNode;
	ItemSeparatorComponent?: ComponentType;
	ListEmptyComponent?: ReactNode;
}) {
	if (data.length === 0) return <>{ListEmptyComponent ?? null}</>;
	return (
		<View>
			{data.map((item, index) => (
				<Fragment key={keyExtractor(item)}>
					{index > 0 && Separator ? <Separator /> : null}
					{renderItem({ item, index })}
				</Fragment>
			))}
		</View>
	);
}
