-- Referencia legible del esquema vigente. La fuente que se ejecuta es migrations/0001_initial_schema.sql;
-- tests/unit/database/sqlite-storage-manager.test.ts comprueba que ambas coinciden.
-- PRAGMA foreign_keys = ON se activa por conexión en SQLiteStorageManager.

-- Configuración global de la aplicación (fila única, id = 1)
CREATE TABLE app_config (
    id                      INTEGER PRIMARY KEY CHECK (id = 1),
    jira_base_url           TEXT    NOT NULL,
    jira_email              TEXT    NOT NULL,
    jira_api_token          TEXT    NOT NULL,
    jira_timeout_seconds    INTEGER NOT NULL DEFAULT 10,
    ollama_host             TEXT    NOT NULL DEFAULT 'http://localhost:11434',
    ollama_model            TEXT    NOT NULL DEFAULT 'qwen2.5:3b',
    ollama_timeout_seconds  INTEGER NOT NULL DEFAULT 120,
    branch_prefix_feature   TEXT    NOT NULL DEFAULT 'features',
    branch_prefix_bugfix    TEXT    NOT NULL DEFAULT 'bugs',
    branch_user_suffix      TEXT    NOT NULL,
    tickets_root_path       TEXT    NOT NULL,
    adjuntos_dir_name       TEXT    NOT NULL DEFAULT 'adjuntos',
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Claves de proyecto de Jira dadas de alta por el usuario
CREATE TABLE jira_projects (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    jira_project_key    TEXT    NOT NULL UNIQUE,      -- 'SCRUM'
    jira_project_name   TEXT    NOT NULL,             -- 'Mi Team' (validado contra Jira en el alta)
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Repositorios locales asociados a una clave (0..N por clave)
CREATE TABLE repositories (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    jira_project_id     INTEGER NOT NULL REFERENCES jira_projects(id) ON DELETE CASCADE,
    name                TEXT    NOT NULL,             -- 'backend', 'frontend'
    repo_local_path     TEXT    NOT NULL,
    default_base_branch TEXT    NOT NULL DEFAULT 'main', -- rama desde la que nacen las nuevas; la elige el usuario
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (jira_project_id, name)
);

-- Una fila por ticket y repositorio (cada ejecución trabaja sobre un repositorio)
CREATE TABLE ticket_logs (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id           TEXT    NOT NULL,             -- 'SCRUM-2'
    jira_project_id     INTEGER NOT NULL REFERENCES jira_projects(id),
    repository_id       INTEGER REFERENCES repositories(id),  -- NULL si la clave no tiene repos
    issue_type          TEXT    NOT NULL,             -- tipo de Jira tal cual ('Error', 'Historia'…)
    branch_type         TEXT    NOT NULL CHECK (branch_type IN ('feature', 'bugfix')),
    branch_name         TEXT,                         -- 'bugs/SCRUM-2-AROCHA'; NULL sin repositorio
    base_branch         TEXT,                         -- rama base usada en esta ejecución ('main', 'develop'…)
    branch_status       TEXT    CHECK (branch_status IN ('created', 'already_existed', 'pending_changes', 'error')),
    jira_fetch_status   TEXT    NOT NULL CHECK (jira_fetch_status IN ('ok', 'fallback_manual')),
    jira_fetch_error    TEXT,
    ollama_status       TEXT    CHECK (ollama_status IN ('ok', 'fallback_deterministic', 'reused')),  -- NULL si se cortó en Git
    ollama_error        TEXT,
    prompt_version      TEXT,                         -- 'bug-v3'
    folder_path         TEXT,                         -- NULL si se cortó en Git
    document_path       TEXT,                         -- NULL si se cortó en Git
    started_at          DATETIME NOT NULL,
    finished_at         DATETIME,

    UNIQUE (ticket_id, repository_id)                 -- upsert al reejecutar
);

CREATE INDEX idx_ticket_logs_project ON ticket_logs(jira_project_id);
CREATE INDEX idx_ticket_logs_repository ON ticket_logs(repository_id);
CREATE INDEX idx_ticket_logs_ticket_id ON ticket_logs(ticket_id);
