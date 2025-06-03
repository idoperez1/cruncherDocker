import {
  Icon,
  IconButton,
  IconButtonProps,
  Separator,
  Stack,
} from "@chakra-ui/react";
import { ReactNode, useCallback, useState } from "react";
import { LuFileSearch, LuBolt } from "react-icons/lu";
import { Tooltip } from "~components/ui/tooltip";
import logo from "src/icons/png/256x256.png";

export const SideMenu = () => {
  const { selectedItem, itemProps } = useMenu("searcher");

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
        </Stack>
      </Stack>
      <Separator orientation="vertical" m={0} p={0} />
    </Stack>
  );
};

const useMenu = (defaultSelected: string) => {
  const [selectedItem, setSelectedItems] = useState<string>(defaultSelected);

  const itemProps = useCallback(
    (itemKey: string) => {
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

const getPropsBySelected = (
  itemId: string,
  selected: string
): Pick<IconButtonProps, "variant"> => {
  return {
    variant: itemId === selected ? "solid" : "outline",
  };
};
