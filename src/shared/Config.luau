-- Все настройки режима в одном месте: меняй числа, чтобы сделать игру легче или сложнее.
local Config = {}

-- Смена дня и ночи (в секундах)
Config.DayDuration = 150
Config.NightDuration = 100

-- Голод и жажда
Config.MaxHunger = 100
Config.MaxThirst = 100
Config.HungerDecay = 0.4 -- в секунду
Config.ThirstDecay = 0.55 -- в секунду
Config.StarveDamage = 3 -- урон в секунду, если голод или жажда на нуле
Config.RegenThreshold = 50 -- здоровье восстанавливается, только если сыт и не хочешь пить
Config.NaturalRegen = 0.5 -- здоровья в секунду
Config.BerryFood = 20
Config.DrinkAmount = 35

-- Предметы
Config.Items = {
	Wood = { Name = "Древесина" },
	Stone = { Name = "Камень" },
	Berry = { Name = "Ягоды" },
}
Config.ItemOrder = { "Wood", "Stone", "Berry" }

-- Ресурсы на карте
Config.GatherHoldTime = 0.5
Config.Resources = {
	Tree = { Item = "Wood", Amount = 5, Respawn = 45, Count = 70, Action = "Рубить", Label = "Дерево" },
	Rock = { Item = "Stone", Amount = 4, Respawn = 60, Count = 40, Action = "Добыть", Label = "Камень" },
	Bush = { Item = "Berry", Amount = 3, Respawn = 40, Count = 35, Action = "Собрать", Label = "Ягодный куст" },
}

-- Рецепты крафта (порядок = порядок кнопок в интерфейсе)
Config.Recipes = {
	{ Id = "Sword", Name = "Меч", Cost = { Wood = 3, Stone = 2 }, Description = "Бей зомби (ЛКМ)" },
	{ Id = "Campfire", Name = "Костёр", Cost = { Wood = 5, Stone = 3 }, Description = "Светит и лечит рядом" },
	{ Id = "Wall", Name = "Стена", Cost = { Wood = 4 }, Description = "Задерживает зомби" },
}

Config.Sword = { Name = "Меч", Damage = 25, Range = 8, Cooldown = 0.5 }
Config.Campfire = { Lifetime = 240, HealRadius = 16, HealPerSecond = 4 }
Config.Wall = { Health = 150 }

-- Зомби
Config.Zombie = {
	Health = 60,
	HealthPerDay = 10, -- каждую следующую ночь зомби крепче
	WalkSpeed = 12,
	WalkSpeedPerDay = 0.4,
	MaxWalkSpeed = 15, -- игрок бегает со скоростью 16
	Damage = 15,
	AttackRange = 4.5,
	AttackCooldown = 1,
	BaseCount = 3,
	PerDay = 2,
	MaxAlive = 25,
	SpawnInterval = 1.5,
	SpawnMinDistance = 60,
	SpawnMaxDistance = 90,
}

-- Карта
Config.MapSize = 500
Config.LakeCenter = Vector3.new(70, 0, -60)
Config.LakeRadius = 28
Config.SpawnSafeRadius = 25

-- Названия колонок в таблице игроков
Config.Stats = {
	Days = "Дни",
	Kills = "Убийства",
	Best = "Рекорд",
}

return Config
