-- Генерирует карту: землю, озеро, границы, деревья, камни и ягодные кусты.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Config = require(ReplicatedStorage.Shared.Config)
local PlayerData = require(script.Parent.PlayerData)
local Survival = require(script.Parent.Survival)

local World = {}
World.Folders = {}

local rng = Random.new()
local placed = {} -- позиции уже поставленных ресурсов, чтобы они не слипались

local function newPart(props)
	local part = Instance.new("Part")
	part.Anchored = true
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	for key, value in props do
		part[key] = value
	end
	return part
end

local function newPrompt(parent, actionText, objectText, holdDuration)
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = actionText
	prompt.ObjectText = objectText
	prompt.HoldDuration = holdDuration
	prompt.MaxActivationDistance = 10
	prompt.RequiresLineOfSight = false
	prompt.Parent = parent
	return prompt
end

local function buildTerrain()
	local oldBaseplate = Workspace:FindFirstChild("Baseplate")
	if oldBaseplate then
		oldBaseplate:Destroy()
	end

	local terrain = Workspace.Terrain
	local size = Config.MapSize
	terrain:FillBlock(CFrame.new(0, -8, 0), Vector3.new(size, 16, size), Enum.Material.Grass)

	local lake = Config.LakeCenter
	terrain:FillCylinder(CFrame.new(lake.X, -2, lake.Z), 4, Config.LakeRadius + 6, Enum.Material.Sand)
	terrain:FillCylinder(CFrame.new(lake.X, -4, lake.Z), 8, Config.LakeRadius, Enum.Material.Water)

	-- Невидимые стены по краю карты
	local half = size / 2
	for _, info in {
		{ Vector3.new(half, 30, 0), Vector3.new(2, 60, size) },
		{ Vector3.new(-half, 30, 0), Vector3.new(2, 60, size) },
		{ Vector3.new(0, 30, half), Vector3.new(size, 60, 2) },
		{ Vector3.new(0, 30, -half), Vector3.new(size, 60, 2) },
	} do
		newPart({
			Name = "Border",
			Position = info[1],
			Size = info[2],
			Transparency = 1,
			Parent = World.Folders.Root,
		})
	end

	if not Workspace:FindFirstChildWhichIsA("SpawnLocation", true) then
		local spawn = Instance.new("SpawnLocation")
		spawn.Anchored = true
		spawn.Size = Vector3.new(8, 1, 8)
		spawn.Position = Vector3.new(0, 0.5, 0)
		spawn.Parent = World.Folders.Root
	end
end

local function buildLakePrompts()
	-- Подсказки "Пить" по берегу озера
	local lake = Config.LakeCenter
	local count = 16
	for i = 1, count do
		local angle = (i / count) * math.pi * 2
		local attachment = Instance.new("Attachment")
		attachment.Name = "DrinkSpot"
		attachment.Position =
			Vector3.new(lake.X + math.cos(angle) * (Config.LakeRadius + 1), 2, lake.Z + math.sin(angle) * (Config.LakeRadius + 1))
		attachment.Parent = Workspace.Terrain

		local prompt = newPrompt(attachment, "Пить", "Озеро", 0.8)
		prompt.MaxActivationDistance = 8
		prompt.Triggered:Connect(Survival.drink)
	end
end

local function findFreePosition()
	local half = Config.MapSize / 2 - 15
	local lake = Vector3.new(Config.LakeCenter.X, 0, Config.LakeCenter.Z)
	for _ = 1, 50 do
		local position = Vector3.new(rng:NextNumber(-half, half), 0, rng:NextNumber(-half, half))
		if position.Magnitude < Config.SpawnSafeRadius or (position - lake).Magnitude < Config.LakeRadius + 10 then
			continue
		end
		local tooClose = false
		for _, other in placed do
			if (other - position).Magnitude < 8 then
				tooClose = true
				break
			end
		end
		if not tooClose then
			table.insert(placed, position)
			return position
		end
	end
	return nil
end

local builders = {}

function builders.Tree(position)
	local model = Instance.new("Model")
	model.Name = "Дерево"
	local height = rng:NextNumber(10, 16)
	local trunk = newPart({
		Name = "Trunk",
		Size = Vector3.new(2.2, height, 2.2),
		Position = position + Vector3.new(0, height / 2, 0),
		Color = Color3.fromRGB(105, 70, 45),
		Material = Enum.Material.Wood,
		Parent = model,
	})
	local leavesSize = rng:NextNumber(8, 12)
	newPart({
		Name = "Leaves",
		Shape = Enum.PartType.Ball,
		Size = Vector3.one * leavesSize,
		Position = position + Vector3.new(0, height + leavesSize * 0.25, 0),
		Color = Color3.fromRGB(rng:NextInteger(50, 75), rng:NextInteger(120, 150), rng:NextInteger(45, 65)),
		Material = Enum.Material.Grass,
		CanCollide = false,
		Parent = model,
	})
	return model, trunk
end

function builders.Rock(position)
	local model = Instance.new("Model")
	model.Name = "Камень"
	local size = rng:NextNumber(4, 7)
	local rock = newPart({
		Name = "Rock",
		Size = Vector3.new(size, size * 0.7, size * rng:NextNumber(0.8, 1.2)),
		CFrame = CFrame.new(position + Vector3.new(0, size * 0.25, 0))
			* CFrame.Angles(rng:NextNumber(-0.3, 0.3), rng:NextNumber(0, math.pi), rng:NextNumber(-0.3, 0.3)),
		Color = Color3.fromRGB(120, 120, 125),
		Material = Enum.Material.Slate,
		Parent = model,
	})
	return model, rock
end

function builders.Bush(position)
	local model = Instance.new("Model")
	model.Name = "Ягодный куст"
	local bush = newPart({
		Name = "Bush",
		Shape = Enum.PartType.Ball,
		Size = Vector3.one * 4,
		Position = position + Vector3.new(0, 1.5, 0),
		Color = Color3.fromRGB(40, 100, 45),
		Material = Enum.Material.Grass,
		Parent = model,
	})
	for i = 1, 5 do
		local angle = i / 5 * math.pi * 2
		newPart({
			Name = "Berry",
			Shape = Enum.PartType.Ball,
			Size = Vector3.one * 0.6,
			Position = bush.Position + Vector3.new(math.cos(angle) * 1.8, rng:NextNumber(-0.5, 1), math.sin(angle) * 1.8),
			Color = Color3.fromRGB(200, 30, 60),
			Material = Enum.Material.SmoothPlastic,
			CanCollide = false,
			Parent = model,
		})
	end
	return model, bush
end

local function spawnResource(kind, settings)
	local position = findFreePosition()
	if not position then
		return
	end
	local model, mainPart = builders[kind](position)
	model.PrimaryPart = mainPart
	model.Parent = World.Folders.Resources

	local remaining = settings.Amount
	local prompt = newPrompt(mainPart, settings.Action, settings.Label, Config.GatherHoldTime)
	prompt.Triggered:Connect(function(player)
		if remaining <= 0 or not PlayerData.getAliveCharacter(player) then
			return
		end
		remaining -= 1
		PlayerData.addItem(player, settings.Item, 1)
		if remaining <= 0 then
			-- Ресурс исчезает и вырастает заново через некоторое время
			model.Parent = nil
			task.delay(settings.Respawn, function()
				remaining = settings.Amount
				model.Parent = World.Folders.Resources
			end)
		end
	end)
end

function World.generate()
	local root = Instance.new("Folder")
	root.Name = "SurvivalWorld"
	root.Parent = Workspace
	World.Folders.Root = root
	for _, name in { "Resources", "Barriers", "Campfires", "Zombies" } do
		local folder = Instance.new("Folder")
		folder.Name = name
		folder.Parent = root
		World.Folders[name] = folder
	end

	buildTerrain()
	buildLakePrompts()
	for kind, settings in Config.Resources do
		for _ = 1, settings.Count do
			spawnResource(kind, settings)
		end
	end
end

return World
