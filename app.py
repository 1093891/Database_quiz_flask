import csv
from flask import Flask, render_template, jsonify, request
import os
import random

app = Flask(__name__)


# Function to parse questions from CSV
def load_questions_from_csv(file_path):
    questions = []
    with open(file_path, 'r', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        for i, row in enumerate(reader):
            line_num = i + 2  # +1 for 0-index, +1 for header row
            try:
                # Basic validation for essential fields before processing
                required_cols = ['id', 'type', 'difficulty', 'question', 'explanation']
                if not all(key in row and row[key] is not None for key in required_cols):
                    missing_keys = [key for key in required_cols if key not in row or row[key] is None]
                    raise KeyError(f"Missing or None value for required columns: {', '.join(missing_keys)}.")

                question_data = {
                    "id": row['id'],
                    "type": row['type'],
                    "difficulty": row['difficulty'],
                    "question": row['question'],
                    "explanation": row['explanation']
                }

                if row['type'] == 'mcq':
                    if not row['options']:
                        raise ValueError("MCQ question has an empty 'options' field.")
                    question_data['options'] = row['options'].split('|')
                    try:
                        question_data['correctAnswerIndex'] = int(row['correct_answer'])
                    except (ValueError, KeyError):
                        raise ValueError("MCQ 'correct_answer' is not a valid integer index or is missing.")
                elif row['type'] == 'true_false':
                    correct_ans_str = row.get('correct_answer', '').strip().lower()
                    if correct_ans_str not in ('true', 'false'):
                        raise ValueError("True/False 'correct_answer' must be 'true' or 'false'.")
                    question_data['correctAnswer'] = correct_ans_str == 'true'
                elif row['type'] == 'drag_drop':
                    if not row['options']:
                        raise ValueError("Drag-and-drop question has an empty 'options' field.")

                    parts = row['options'].split(';')
                    if len(parts) != 3:
                        raise ValueError(
                            f"Drag-and-drop question 'options' field malformed. Expected 3 parts separated by ';', got {len(parts)}.")

                    def parse_id_text_list(raw_list_str, field_name):
                        parsed_items = []
                        if not raw_list_str:
                            return parsed_items
                        for item_str in raw_list_str.split('|'):
                            if ':' not in item_str:
                                raise ValueError(
                                    f"Drag-and-drop '{field_name}' item '{item_str}' is malformed. Missing ':'.")
                            item_id, item_text = item_str.split(':', 1)
                            if not item_id or not item_text:
                                raise ValueError(
                                    f"Drag-and-drop '{field_name}' item '{item_str}' has empty ID or text.")
                            parsed_items.append({"id": item_id, "text": item_text})
                        return parsed_items

                    question_data['draggableItems'] = parse_id_text_list(parts[0], 'draggable_items')
                    question_data['droppableTargets'] = parse_id_text_list(parts[1], 'droppable_targets')

                    correct_mapping_raw = parts[2]
                    question_data['correctMapping'] = {}
                    if not correct_mapping_raw:
                        raise ValueError("Drag-and-drop 'correctMapping' field is empty.")
                    for mapping_str in correct_mapping_raw.split('|'):
                        if ':' not in mapping_str:
                            raise ValueError(f"Drag-and-drop mapping '{mapping_str}' is malformed. Missing ':'.")
                        draggable_id, droppable_id = mapping_str.split(':', 1)
                        if not draggable_id or not droppable_id:
                            raise ValueError(
                                f"Drag-and-drop mapping '{mapping_str}' has empty draggable or droppable ID.")
                        question_data['correctMapping'][draggable_id] = droppable_id

                elif row['type'] == 'fill_in_the_blank':
                    question_data['placeholderText'] = row.get('options', '')  # Using options column for placeholder
                    question_data['correctAnswer'] = row.get('correct_answer', '')
                    if not question_data['correctAnswer']:
                        raise ValueError("Fill in the blank question is missing 'correct_answer'.")

                elif row['type'] == 'trace_the_output':
                    question_data['codeSnippet'] = row.get('options', '')  # Using options column for code snippet
                    question_data['correctOutput'] = row.get('correct_answer', '')
                    if not question_data['codeSnippet'] or not question_data['correctOutput']:
                        raise ValueError("Trace the output question is missing 'code_snippet' or 'correct_output'.")

                elif row['type'] == 'write_full_code':
                    # 'options' column is not used for this type
                    question_data['correctCodeSolution'] = row.get('correct_answer',
                                                                   '')  # Using correct_answer for solution code
                    if not question_data['correctCodeSolution']:
                        raise ValueError("Write full code question is missing 'correct_code_solution'.")

                questions.append(question_data)
            except KeyError as e:
                print(f"Error: Missing column '{e}' in row {line_num} of questions.csv. Row: {row}")
            except ValueError as e:
                print(f"Error parsing question on line {line_num} (ID: {row.get('id', 'N/A')}): {e}. Row: {row}")
            except Exception as e:
                print(f"Unexpected error processing row {line_num} (ID: {row.get('id', 'N/A')}): {e}. Row: {row}")
    return questions


# Get the directory of the current script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
QUESTIONS_FILE = os.path.join(BASE_DIR, 'questions.csv')

# Load questions once when the app starts
try:
    ALL_QUIZ_QUESTIONS = load_questions_from_csv(QUESTIONS_FILE)
    if not ALL_QUIZ_QUESTIONS:
        print("\n--- WARNING ---")
        print("No questions were loaded from questions.csv. This could be due to:")
        print("1. The file does not exist at the expected path: %s" % QUESTIONS_FILE)
        print("2. The file is empty or contains only headers.")
        print(
            "3. All questions in the file had critical parsing errors (see above 'Error parsing question' messages).\n")
except FileNotFoundError:
    print(f"\n--- CRITICAL ERROR ---")
    print(f"questions.csv not found at {QUESTIONS_FILE}.")
    print("Please ensure the 'questions.csv' file is in the same directory as 'app.py'.\n")
    ALL_QUIZ_QUESTIONS = []
except Exception as e:
    print(f"\n--- CRITICAL ERROR during initial loading of questions.csv: {e} ---\n")
    ALL_QUIZ_QUESTIONS = []


@app.route('/')
def index():
    """Renders the main quiz application page."""
    return render_template('index.html')


@app.route('/api/questions')
def get_questions():
    """
    Returns a subset of quiz questions based on the requested number.
    Shuffles questions before returning.
    """
    num_questions_str = request.args.get('count', type=str)

    if not ALL_QUIZ_QUESTIONS:
        return jsonify(
            {"error": "No questions loaded. Check server logs for specific parsing errors during startup."}), 500

    if num_questions_str and num_questions_str.isdigit():
        num_questions = int(num_questions_str)
        if num_questions <= 0:
            return jsonify({"error": "Number of questions must be positive."}), 400

        shuffled_questions = random.sample(ALL_QUIZ_QUESTIONS, min(num_questions, len(ALL_QUIZ_QUESTIONS)))
        return jsonify(shuffled_questions)
    else:
        return jsonify(ALL_QUIZ_QUESTIONS)


if __name__ == '__main__':
    os.makedirs(os.path.join(BASE_DIR, 'templates'), exist_ok=True)
    os.makedirs(os.path.join(BASE_DIR, 'static', 'css'), exist_ok=True)
    os.makedirs(os.path.join(BASE_DIR, 'static', 'js'), exist_ok=True)
    os.makedirs(os.path.join(BASE_DIR, 'static', 'images'), exist_ok=True)  # Ensure images folder exists
    app.run(debug=True)
