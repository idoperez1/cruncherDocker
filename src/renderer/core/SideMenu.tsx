import { Badge, Icon, IconButton, Separator, Stack } from "@chakra-ui/react";
import { createLink, Link } from "@tanstack/react-router";
import { forwardRef, ReactNode, useMemo } from "react";
import { LuBolt, LuFileSearch } from "react-icons/lu";
import { useAsync } from "react-use";
import logo from "src/icons/png/256x256.png";
import { Tooltip } from "~components/ui/tooltip";

export type MenuItem = "searcher" | "settings";

export const SideMenu = () => {
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
            <Link to="/">
              {({ isActive }) => (
                <MenuButton
                  isActive={isActive}
                  tooltip="Searcher"
                  icon={<LuFileSearch />}
                />
              )}
            </Link>
          </Stack>
        </Stack>

        <Stack>
          <Separator />
          <Stack gap={2}>
            <Link to={"/settings"}>
              {({ isActive }) => (
                <MenuButton
                  isActive={isActive}
                  tooltip="Settings"
                  icon={<LuBolt />}
                />
              )}
            </Link>
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

const MenuButton: React.FC<{
  isActive?: boolean;
  tooltip: string;
  icon: ReactNode;
}> = ({ isActive: isSelected, tooltip, icon }) => {
  return (
    <Tooltip
      content={tooltip}
      showArrow
      positioning={{
        placement: "right",
      }}
    >
      <IconButton variant={isSelected ? "solid" : "outline"}>{icon}</IconButton>
    </Tooltip>
  );
};
