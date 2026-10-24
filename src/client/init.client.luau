-- Интерфейс игрока: время суток, здоровье/голод/жажда, рюкзак, крафт и уведомления.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))
local Remotes = ReplicatedStorage:WaitForChild("Remotes")
local player = Players.LocalPlayer

local PANEL_COLOR = Color3.fromRGB(20, 24, 30)
local TEXT_COLOR = Color3.fromRGB(240, 240, 240)
local MUTED_COLOR = Color3.fromRGB(170, 175, 185)
local NOTIFY_COLORS = {
	info = Color3.fromRGB(240, 240, 240),
	good = Color3.fromRGB(130, 230, 130),
	warn = Color3.fromRGB(255, 210, 90),
	bad = Color3.fromRGB(255, 100, 100),
	item = Color3.fromRGB(180, 220, 255),
}

local function create(className, props, children)
	local instance = Instance.new(className)
	for key, value in props or {} do
		instance[key] = value
	end
	for _, child in children or {} do
		child.Parent = instance
	end
	return instance
end

local function corner(radius)
	return create("UICorner", { CornerRadius = UDim.new(0, radius or 8) })
end

local function padding(pixels)
	return create("UIPadding", {
		PaddingTop = UDim.new(0, pixels),
		PaddingBottom = UDim.new(0, pixels),
		PaddingLeft = UDim.new(0, pixels),
		PaddingRight = UDim.new(0, pixels),
	})
end

local function panel(props, children)
	props.BackgroundColor3 = PANEL_COLOR
	props.BackgroundTransparency = 0.25
	table.insert(children, corner(10))
	return create("Frame", props, children)
end

local function label(props)
	props.BackgroundTransparency = 1
	props.TextColor3 = props.TextColor3 or TEXT_COLOR
	props.Font = props.Font or Enum.Font.GothamMedium
	props.TextSize = props.TextSize or 16
	props.TextXAlignment = props.TextXAlignment or Enum.TextXAlignment.Left
	return create("TextLabel", props)
end

local function formatTime(seconds)
	seconds = math.max(0, math.floor(seconds))
	return string.format("%d:%02d", seconds // 60, seconds % 60)
end

local gui = create("ScreenGui", {
	Name = "SurvivalHud",
	ResetOnSpawn = false,
	ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
})

--------------------------------------------------------------------------
-- Время суток (сверху по центру)
--------------------------------------------------------------------------
local dayTitle = label({
	Size = UDim2.new(1, 0, 0, 24),
	Font = Enum.Font.GothamBold,
	TextSize = 20,
	TextXAlignment = Enum.TextXAlignment.Center,
})
local dayTimer = label({
	Size = UDim2.new(1, 0, 0, 18),
	Position = UDim2.new(0, 0, 0, 26),
	TextColor3 = MUTED_COLOR,
	TextSize = 14,
	TextXAlignment = Enum.TextXAlignment.Center,
})
panel({
	Name = "DayPanel",
	AnchorPoint = Vector2.new(0.5, 0),
	Position = UDim2.new(0.5, 0, 0, 8),
	Size = UDim2.new(0, 260, 0, 58),
	Parent = gui,
}, { padding(6), dayTitle, dayTimer })

--------------------------------------------------------------------------
-- Уведомления (под временем суток)
--------------------------------------------------------------------------
local notifications = create("Frame", {
	Name = "Notifications",
	AnchorPoint = Vector2.new(0.5, 0),
	Position = UDim2.new(0.5, 0, 0, 74),
	Size = UDim2.new(0, 420, 0, 200),
	BackgroundTransparency = 1,
	Parent = gui,
}, {
	create("UIListLayout", {
		HorizontalAlignment = Enum.HorizontalAlignment.Center,
		SortOrder = Enum.SortOrder.LayoutOrder,
		Padding = UDim.new(0, 4),
	}),
})

local notifyCounter = 0
local function notify(text, kind)
	notifyCounter += 1
	local message = label({
		Text = text,
		Size = UDim2.new(1, 0, 0, 26),
		Font = Enum.Font.GothamBold,
		TextSize = kind == "item" and 16 or 20,
		TextColor3 = NOTIFY_COLORS[kind] or NOTIFY_COLORS.info,
		TextStrokeTransparency = 0.4,
		TextXAlignment = Enum.TextXAlignment.Center,
		LayoutOrder = notifyCounter,
		Parent = notifications,
	})
	local items = notifications:GetChildren()
	if #items > 7 then
		-- Слишком много сообщений: убираем самое старое
		local oldest = nil
		for _, child in items do
			if child:IsA("TextLabel") and (not oldest or child.LayoutOrder < oldest.LayoutOrder) then
				oldest = child
			end
		end
		oldest:Destroy()
	end
	task.delay(kind == "item" and 1.5 or 3.5, function()
		if not message.Parent then
			return
		end
		local fade = TweenService:Create(message, TweenInfo.new(0.6), { TextTransparency = 1, TextStrokeTransparency = 1 })
		fade:Play()
		fade.Completed:Wait()
		message:Destroy()
	end)
end

Remotes.Notify.OnClientEvent:Connect(notify)

--------------------------------------------------------------------------
-- Полоски здоровья, голода и жажды (снизу слева)
--------------------------------------------------------------------------
local statsPanel = panel({
	Name = "Stats",
	AnchorPoint = Vector2.new(0, 1),
	Position = UDim2.new(0, 12, 1, -12),
	Size = UDim2.new(0, 240, 0, 0),
	AutomaticSize = Enum.AutomaticSize.Y,
	Parent = gui,
}, {
	padding(10),
	create("UIListLayout", { SortOrder = Enum.SortOrder.LayoutOrder, Padding = UDim.new(0, 6) }),
})

local function makeBar(order, title, color)
	local fill = create("Frame", {
		Size = UDim2.new(1, 0, 1, 0),
		BackgroundColor3 = color,
	}, { corner(5) })
	local value = label({
		Size = UDim2.new(1, -8, 1, 0),
		Position = UDim2.new(0, 8, 0, 0),
		TextSize = 13,
		Font = Enum.Font.GothamBold,
		TextStrokeTransparency = 0.5,
		ZIndex = 2,
	})
	create("Frame", {
		LayoutOrder = order,
		Size = UDim2.new(1, 0, 0, 22),
		BackgroundColor3 = Color3.fromRGB(45, 50, 58),
		Parent = statsPanel,
	}, { corner(5), fill, value })

	return function(current, max)
		local ratio = max > 0 and math.clamp(current / max, 0, 1) or 0
		TweenService:Create(fill, TweenInfo.new(0.25), { Size = UDim2.new(ratio, 0, 1, 0) }):Play()
		value.Text = string.format("%s  %d / %d", title, math.ceil(current), max)
	end
end

local setHealth = makeBar(1, "Здоровье", Color3.fromRGB(210, 60, 60))
local setHunger = makeBar(2, "Голод", Color3.fromRGB(230, 140, 50))
local setThirst = makeBar(3, "Жажда", Color3.fromRGB(60, 140, 230))

label({
	LayoutOrder = 4,
	Size = UDim2.new(1, 0, 0, 30),
	Text = "[E] собирать / пить   [F] съесть ягоды\n[1] взять меч   ЛКМ — удар",
	TextColor3 = MUTED_COLOR,
	TextSize = 12,
	Parent = statsPanel,
})

local function refreshSurvival()
	setHunger(player:GetAttribute("Hunger") or 0, Config.MaxHunger)
	setThirst(player:GetAttribute("Thirst") or 0, Config.MaxThirst)
end
player:GetAttributeChangedSignal("Hunger"):Connect(refreshSurvival)
player:GetAttributeChangedSignal("Thirst"):Connect(refreshSurvival)
refreshSurvival()

local function bindCharacter(character)
	local humanoid = character:WaitForChild("Humanoid")
	local function refresh()
		setHealth(humanoid.Health, humanoid.MaxHealth)
	end
	humanoid.HealthChanged:Connect(refresh)
	refresh()
end
player.CharacterAdded:Connect(bindCharacter)
if player.Character then
	task.spawn(bindCharacter, player.Character)
end

--------------------------------------------------------------------------
-- Рюкзак и крафт (справа)
--------------------------------------------------------------------------
local sidePanel = panel({
	Name = "Backpack",
	AnchorPoint = Vector2.new(1, 0.5),
	Position = UDim2.new(1, -12, 0.5, 0),
	Size = UDim2.new(0, 230, 0, 0),
	AutomaticSize = Enum.AutomaticSize.Y,
	Parent = gui,
}, {
	padding(10),
	create("UIListLayout", { SortOrder = Enum.SortOrder.LayoutOrder, Padding = UDim.new(0, 6) }),
})

local layoutOrder = 0
local function nextOrder()
	layoutOrder += 1
	return layoutOrder
end

local function sectionTitle(text)
	label({
		LayoutOrder = nextOrder(),
		Size = UDim2.new(1, 0, 0, 22),
		Text = text,
		Font = Enum.Font.GothamBold,
		TextSize = 18,
		Parent = sidePanel,
	})
end

local function button(text, color)
	return create("TextButton", {
		LayoutOrder = nextOrder(),
		Size = UDim2.new(1, 0, 0, 40),
		BackgroundColor3 = color,
		AutoButtonColor = true,
		Text = text,
		TextColor3 = TEXT_COLOR,
		Font = Enum.Font.GothamBold,
		TextSize = 14,
		TextWrapped = true,
		Parent = sidePanel,
	}, { corner(6) })
end

sectionTitle("Рюкзак")
local itemLabels = {}
for _, itemId in Config.ItemOrder do
	itemLabels[itemId] = label({
		LayoutOrder = nextOrder(),
		Size = UDim2.new(1, 0, 0, 18),
		TextSize = 15,
		Parent = sidePanel,
	})
end

local eatButton = button("Съесть ягоды [F]", Color3.fromRGB(150, 50, 70))
eatButton.Activated:Connect(function()
	Remotes.Eat:FireServer()
end)

sectionTitle("Крафт")
local ENABLED_COLOR = Color3.fromRGB(60, 120, 70)
local DISABLED_COLOR = Color3.fromRGB(70, 72, 78)
local recipeButtons = {}
for _, recipe in Config.Recipes do
	local parts = {}
	for _, itemId in Config.ItemOrder do
		local amount = recipe.Cost[itemId]
		if amount then
			table.insert(parts, Config.Items[itemId].Name .. " ×" .. amount)
		end
	end
	local craftButton = button(recipe.Name .. "\n" .. table.concat(parts, ", "), DISABLED_COLOR)
	craftButton.Size = UDim2.new(1, 0, 0, 46)
	craftButton.Activated:Connect(function()
		Remotes.Craft:FireServer(recipe.Id)
	end)
	label({
		LayoutOrder = nextOrder(),
		Size = UDim2.new(1, 0, 0, 14),
		Text = recipe.Description,
		TextColor3 = MUTED_COLOR,
		TextSize = 12,
		Parent = sidePanel,
	})
	recipeButtons[recipe] = craftButton
end

local function getItem(itemId)
	return player:GetAttribute("Item_" .. itemId) or 0
end

local function refreshInventory()
	for itemId, itemLabel in itemLabels do
		itemLabel.Text = Config.Items[itemId].Name .. ": " .. getItem(itemId)
	end
	for recipe, craftButton in recipeButtons do
		local canCraft = true
		for itemId, amount in recipe.Cost do
			if getItem(itemId) < amount then
				canCraft = false
			end
		end
		craftButton.BackgroundColor3 = canCraft and ENABLED_COLOR or DISABLED_COLOR
	end
end

local previousCounts = {}
for _, itemId in Config.ItemOrder do
	previousCounts[itemId] = getItem(itemId)
	player:GetAttributeChangedSignal("Item_" .. itemId):Connect(function()
		local count = getItem(itemId)
		local gained = count - previousCounts[itemId]
		previousCounts[itemId] = count
		if gained > 0 then
			notify("+" .. gained .. " " .. Config.Items[itemId].Name, "item")
		end
		refreshInventory()
	end)
end
refreshInventory()

--------------------------------------------------------------------------
-- Управление и обновление таймера
--------------------------------------------------------------------------
UserInputService.InputBegan:Connect(function(input, gameProcessed)
	if not gameProcessed and input.KeyCode == Enum.KeyCode.F then
		Remotes.Eat:FireServer()
	end
end)

gui.Parent = player:WaitForChild("PlayerGui")
notify("Добро пожаловать! Собирай ресурсы и готовься к ночи.", "good")

while true do
	local day = ReplicatedStorage:GetAttribute("Day") or 1
	local isNight = ReplicatedStorage:GetAttribute("IsNight")
	local endsAt = ReplicatedStorage:GetAttribute("PhaseEndsAt") or 0
	local remaining = formatTime(endsAt - Workspace:GetServerTimeNow())
	dayTitle.Text = "День " .. day .. (isNight and " · Ночь" or " · День")
	dayTitle.TextColor3 = isNight and Color3.fromRGB(150, 170, 255) or Color3.fromRGB(255, 220, 120)
	dayTimer.Text = (isNight and "До рассвета: " or "До ночи: ") .. remaining
	task.wait(0.25)
end
