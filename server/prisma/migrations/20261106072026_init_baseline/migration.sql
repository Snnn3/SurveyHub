-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SURVEY_OWNER', 'RESPONDENT');

-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SurveyMode" AS ENUM ('IDENTIFIED', 'ANONYMOUS');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTI_CHOICE', 'SHORT_TEXT', 'LONG_TEXT', 'YES_NO', 'LIKERT', 'RATING', 'INTEGER', 'DATE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surveys" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "SurveyStatus" NOT NULL DEFAULT 'DRAFT',
    "mode" "SurveyMode" NOT NULL DEFAULT 'IDENTIFIED',
    "owner_id" TEXT NOT NULL,
    "published_at" TIMESTAMP(3),
    "closes_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_eligibility" (
    "id" TEXT NOT NULL,
    "survey_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_eligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "survey_id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "question_type" "QuestionType" NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "min_selections" INTEGER,
    "max_selections" INTEGER,
    "number_min" INTEGER,
    "number_max" INTEGER,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "options" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_responses" (
    "id" TEXT NOT NULL,
    "survey_id" TEXT NOT NULL,
    "respondent_id" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "response_claims" (
    "id" TEXT NOT NULL,
    "survey_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "response_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" TEXT NOT NULL,
    "response_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "text_value" TEXT,
    "number_value" INTEGER,
    "date_value" DATE,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answer_options" (
    "id" TEXT NOT NULL,
    "answer_id" TEXT NOT NULL,
    "option_id" TEXT NOT NULL,

    CONSTRAINT "answer_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "surveys_owner_id_status_idx" ON "surveys"("owner_id", "status");

-- CreateIndex
CREATE INDEX "surveys_status_closes_at_idx" ON "surveys"("status", "closes_at");

-- CreateIndex
CREATE INDEX "survey_eligibility_user_id_idx" ON "survey_eligibility"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "survey_eligibility_survey_id_user_id_key" ON "survey_eligibility"("survey_id", "user_id");

-- CreateIndex
CREATE INDEX "questions_survey_id_order_index_idx" ON "questions"("survey_id", "order_index");

-- CreateIndex
CREATE INDEX "options_question_id_order_index_idx" ON "options"("question_id", "order_index");

-- CreateIndex
CREATE UNIQUE INDEX "options_question_id_label_key" ON "options"("question_id", "label");

-- CreateIndex
CREATE INDEX "survey_responses_survey_id_submitted_at_idx" ON "survey_responses"("survey_id", "submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "survey_responses_survey_id_respondent_id_key" ON "survey_responses"("survey_id", "respondent_id");

-- CreateIndex
CREATE INDEX "response_claims_user_id_idx" ON "response_claims"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "response_claims_survey_id_user_id_key" ON "response_claims"("survey_id", "user_id");

-- CreateIndex
CREATE INDEX "answers_question_id_idx" ON "answers"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "answers_response_id_question_id_key" ON "answers"("response_id", "question_id");

-- CreateIndex
CREATE INDEX "answer_options_option_id_idx" ON "answer_options"("option_id");

-- CreateIndex
CREATE UNIQUE INDEX "answer_options_answer_id_option_id_key" ON "answer_options"("answer_id", "option_id");

-- AddForeignKey
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_eligibility" ADD CONSTRAINT "survey_eligibility_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_eligibility" ADD CONSTRAINT "survey_eligibility_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "options" ADD CONSTRAINT "options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_respondent_id_fkey" FOREIGN KEY ("respondent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_claims" ADD CONSTRAINT "response_claims_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_claims" ADD CONSTRAINT "response_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "survey_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_options" ADD CONSTRAINT "answer_options_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_options" ADD CONSTRAINT "answer_options_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Custom check constraints (CPE 334 SDS Section 2.4 - Defence in Depth)
ALTER TABLE "surveys"
  ADD CONSTRAINT survey_title_length CHECK (char_length(title) BETWEEN 1 AND 120);

ALTER TABLE "questions"
  ADD CONSTRAINT question_prompt_length CHECK (char_length(prompt) BETWEEN 1 AND 500),
  ADD CONSTRAINT question_selection_bounds CHECK (
    min_selections IS NULL OR max_selections IS NULL OR
    (min_selections >= 1 AND min_selections <= max_selections)
  ),
  ADD CONSTRAINT question_integer_bounds CHECK (
    number_min IS NULL OR number_max IS NULL OR number_min <= number_max
  );

ALTER TABLE "answers"
  ADD CONSTRAINT answer_text_length CHECK (text_value IS NULL OR char_length(text_value) <= 10000);
