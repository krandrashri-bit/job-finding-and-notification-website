CREATE DATABASE IF NOT EXISTS domain_job_system
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE domain_job_system;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(32) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('seeker', 'employer', 'admin') NOT NULL DEFAULT 'seeker',
  email_enabled TINYINT(1) NOT NULL DEFAULT 1,
  phone_enabled TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS domains (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_domains_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS candidate_domains (
  user_id BIGINT UNSIGNED NOT NULL,
  domain_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, domain_id),
  CONSTRAINT fk_candidate_domains_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_candidate_domains_domain FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(180) NOT NULL,
  company VARCHAR(180) NOT NULL,
  domain_id BIGINT UNSIGNED NOT NULL,
  location VARCHAR(180) NOT NULL,
  salary VARCHAR(100) NULL,
  description TEXT NOT NULL,
  job_type ENUM('Full-time', 'Part-time', 'Internship', 'Remote', 'Contract') NOT NULL DEFAULT 'Full-time',
  status ENUM('draft', 'published', 'closed') NOT NULL DEFAULT 'published',
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_jobs_domain_status_created (domain_id, status, created_at),
  CONSTRAINT fk_jobs_domain FOREIGN KEY (domain_id) REFERENCES domains(id),
  CONSTRAINT fk_jobs_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  job_id BIGINT UNSIGNED NOT NULL,
  channel ENUM('email', 'sms', 'in_app') NOT NULL,
  status ENUM('pending', 'sent', 'failed') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_user_date (user_id, created_at),
  KEY idx_notifications_status (status),
  UNIQUE KEY uq_notifications_user_job_channel (user_id, job_id, channel),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT IGNORE INTO domains (name) VALUES
  ('Software Development'),
  ('Data Science'),
  ('Cyber Security'),
  ('Healthcare'),
  ('Finance'),
  ('Web Development'),
  ('Artificial Intelligence'),
  ('Machine Learning');
