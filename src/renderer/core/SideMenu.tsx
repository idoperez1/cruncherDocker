import { Badge, Icon, IconButton, Separator, Stack } from "@chakra-ui/react";
import { atom, useAtom } from "jotai";
import { ReactNode, useCallback, useMemo } from "react";
import { LuBolt, LuFileSearch } from "react-icons/lu";
import { useAsync } from "react-use";
import logo from "src/icons/png/256x256.png";
import { Tooltip } from "~components/ui/tooltip";

export type MenuItem = "searcher" | "settings";

export const selectedMenuItemAtom = atom<MenuItem>("searcher");

export const SideMenu = () => {
  const { selectedItem, itemProps } = useMenu();
  const versionResult = useAsync(async () => {
    return await window.electronAPI.getVersion();
  }, []);

  const version = useMemo(() => {
    if (!versionResult.value) return "unknown";

    const { tag, isDev } = versionResult.value;

    return tag + (isDev ? "*" : "");
  }, [versionResult]);

  return (
    <Stack direction="row" backgroundColor="rgb(22, 23, 29)" gap={0}>
      <Stack p={2} justify="space-between">
        <Stack>
          <Icon>
            <img
              src={logo}
              alt="Cruncher Logo"
              style={{ width: "40px", height: "40px" }}
            />
          </Icon>
          <Separator />
          <Stack gap={2}>
            <MenuButton
              tooltip="Searcher"
              icon={<LuFileSearch />}
              {...itemProps("searcher")}
            />
          </Stack>
        </Stack>

        <Stack>
          <Separator />
          <Stack gap={2}>
            <MenuButton
              tooltip="Settings"
              icon={<LuBolt />}
              {...itemProps("settings")}
            />
          </Stack>
          <Badge size="xs" variant="surface" justifyContent="center">
            {version}
          </Badge>
        </Stack>
      </Stack>
      <Separator orientation="vertical" m={0} p={0} />
    </Stack>
  );
};

const useMenu = () => {
  const [selectedItem, setSelectedItems] = useAtom(selectedMenuItemAtom);

  const itemProps = useCallback(
    (itemKey: MenuItem) => {
      return {
        onClick: () => {
          setSelectedItems(itemKey);
        },
        isSelected: selectedItem === itemKey,
      };
    },
    [selectedItem]
  );

  return {
    itemProps,
    selectedItem,
  };
};

const MenuButton: React.FC<{
  isSelected?: boolean;
  onClick?: () => void;
  tooltip: string;
  icon: ReactNode;
}> = ({ isSelected, onClick, tooltip, icon }) => {
  return (
    <Tooltip
      content={tooltip}
      showArrow
      positioning={{
        placement: "right",
      }}
    >
      <IconButton variant={isSelected ? "solid" : "outline"} onClick={onClick}>
        {icon}
      </IconButton>
    </Tooltip>
  );
};
